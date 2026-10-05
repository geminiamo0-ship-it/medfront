import { Inject, Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { LabValue } from "../entities/lab-value.entity";
import {
  taxonomyLabValuesCacheKey,
  TAXONOMY_TTL_MS,
} from "../cache/cache-keys.util";
import { safeCacheGet, safeCacheSet, safeCacheDel } from "../cache/safe-cache.util";

@Injectable()
export class LabValuesService {
  constructor(
    @InjectRepository(LabValue)
    private labValueRepository: Repository<LabValue>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async findAllGroupedByCategory() {
    // Fix #3: lab values change ~never. Cache the full grouped payload (~24h).
    const cacheKey = taxonomyLabValuesCacheKey();
    const cached = await safeCacheGet<Record<string, LabValue[]>>(this.cacheManager, cacheKey);
    if (cached) return cached;

    const allValues = await this.labValueRepository.find();

    const grouped = allValues.reduce((acc, current) => {
      const cat = current.category;
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(current);
      return acc;
    }, {} as Record<string, LabValue[]>);

    await safeCacheSet(this.cacheManager, cacheKey, grouped, TAXONOMY_TTL_MS);
    return grouped;
  }

  private async invalidateCache() {
    await safeCacheDel(this.cacheManager, taxonomyLabValuesCacheKey());
  }

  async findPaged(params: {
    limit: number;
    offset: number;
    search?: string;
    category?: string;
  }) {
    const qb = this.labValueRepository.createQueryBuilder("lab");

    if (params.search) {
      const term = `%${params.search.toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(lab.name) LIKE :term OR LOWER(lab.category) LIKE :term)",
        { term },
      );
    }

    if (params.category) {
      qb.andWhere("LOWER(lab.category) = :category", {
        category: params.category.toLowerCase(),
      });
    }

    const total = await qb.getCount();

    const data = await qb
      .orderBy("lab.category", "ASC")
      .addOrderBy("lab.name", "ASC")
      .take(params.limit)
      .skip(params.offset)
      .getMany();

    const categoryRows = await this.labValueRepository
      .createQueryBuilder("lab")
      .select("DISTINCT lab.category", "category")
      .orderBy("lab.category", "ASC")
      .getRawMany<{ category: string }>();

    return {
      data,
      total,
      categories: categoryRows.map((row) => row.category),
    };
  }

  private async ensureUnique(category: string, name: string, id?: string) {
    const qb = this.labValueRepository
      .createQueryBuilder("lab")
      .where("LOWER(lab.category) = :category", {
        category: category.toLowerCase(),
      })
      .andWhere("LOWER(lab.name) = :name", { name: name.toLowerCase() });

    if (id) {
      qb.andWhere("lab.id != :id", { id });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException(
        "A lab value with the same category and name already exists.",
      );
    }
  }

  async createLabValue(payload: {
    category: string;
    name: string;
    referenceRange?: string | null;
    siReferenceInterval?: string | null;
  }) {
    const category = payload.category.trim();
    const name = payload.name.trim();
    await this.ensureUnique(category, name);

    const entity = this.labValueRepository.create({
      category,
      name,
      referenceRange: payload.referenceRange?.trim() || null,
      siReferenceInterval: payload.siReferenceInterval?.trim() || null,
    });

    const saved = await this.labValueRepository.save(entity);
    await this.invalidateCache();
    return saved;
  }

  async updateLabValue(
    id: string,
    payload: {
      category: string;
      name: string;
      referenceRange?: string | null;
      siReferenceInterval?: string | null;
    },
  ) {
    const existing = await this.labValueRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Lab value not found");
    }

    const category = payload.category.trim();
    const name = payload.name.trim();
    await this.ensureUnique(category, name, id);

    existing.category = category;
    existing.name = name;
    existing.referenceRange = payload.referenceRange?.trim() || null;
    existing.siReferenceInterval = payload.siReferenceInterval?.trim() || null;

    const saved = await this.labValueRepository.save(existing);
    await this.invalidateCache();
    return saved;
  }

  async deleteLabValue(id: string) {
    const existing = await this.labValueRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Lab value not found");
    }
    await this.labValueRepository.remove(existing);
    await this.invalidateCache();
    return { success: true };
  }

  async createBulkLabValues(
    items: Array<{
      category: string;
      name: string;
      referenceRange?: string | null;
      siReferenceInterval?: string | null;
    }>,
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException("No lab values provided");
    }

    const cleaned = items.map((item, index) => {
      const category = item.category?.trim();
      const name = item.name?.trim();
      if (!category || !name) {
        throw new BadRequestException(
          `Row ${index + 1} must include category and name`,
        );
      }
      return {
        category,
        name,
        referenceRange: item.referenceRange?.trim() || null,
        siReferenceInterval: item.siReferenceInterval?.trim() || null,
      };
    });

    const seen = new Set<string>();
    const duplicatesInFile: string[] = [];
    const uniqueItems: typeof cleaned = [];
    cleaned.forEach((item) => {
      const key = `${item.category.toLowerCase()}||${item.name.toLowerCase()}`;
      if (seen.has(key)) {
        duplicatesInFile.push(`${item.category} - ${item.name}`);
      } else {
        seen.add(key);
        uniqueItems.push(item);
      }
    });

    if (uniqueItems.length === 0) {
      return {
        created: 0,
        skippedExisting: 0,
        skippedDuplicate: duplicatesInFile.length,
        skippedExistingLabels: [],
        skippedDuplicateLabels: duplicatesInFile,
      };
    }

    const categories = Array.from(
      new Set(uniqueItems.map((item) => item.category.toLowerCase())),
    );
    const names = Array.from(
      new Set(uniqueItems.map((item) => item.name.toLowerCase())),
    );

    const existing = await this.labValueRepository
      .createQueryBuilder("lab")
      .where("LOWER(lab.category) IN (:...categories)", { categories })
      .andWhere("LOWER(lab.name) IN (:...names)", { names })
      .getMany();

    const existingKeys = new Set(
      existing.map(
        (item) => `${item.category.toLowerCase()}||${item.name.toLowerCase()}`,
      ),
    );
    const existingLabels = existing.map(
      (item) => `${item.category} - ${item.name}`,
    );

    const toCreate = uniqueItems.filter((item) => {
      const key = `${item.category.toLowerCase()}||${item.name.toLowerCase()}`;
      return !existingKeys.has(key);
    });

    const entities = toCreate.map((item) =>
      this.labValueRepository.create(item),
    );
    const saved = entities.length
      ? await this.labValueRepository.save(entities)
      : [];

    if (saved.length > 0) {
      await this.invalidateCache();
    }

    return {
      created: saved.length,
      skippedExisting: existingLabels.length,
      skippedDuplicate: duplicatesInFile.length,
      skippedExistingLabels: existingLabels,
      skippedDuplicateLabels: duplicatesInFile,
    };
  }
}
