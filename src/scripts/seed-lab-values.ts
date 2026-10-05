import * as fs from "fs";
import * as path from "path";
import dataSource from "../config/typeorm.config";
import { LabValue } from "../entities/lab-value.entity";

async function seedLabValues() {
  await dataSource.initialize();
  console.log("DataSource initialized.");

  const labValuesRepo = dataSource.getRepository(LabValue);

  // Clear existing to avoid duplicates in case of re-run
  await labValuesRepo.clear();

  const directoryPath = path.join(__dirname, "../../lab-pdfs");
  const files = fs
    .readdirSync(directoryPath)
    .filter((file) => file.endsWith(".json"));

  let totalInserted = 0;

  for (const file of files) {
    const categoryName = file.replace(".json", "").replace("&", " & ");
    const filePath = path.join(directoryPath, file);
    const fileContent = fs.readFileSync(filePath, "utf8");
    const records = JSON.parse(fileContent);

    for (const record of records) {
      const name = record.Test?.replace(/\[cite:\s*\d+\]/g, "").trim();
      const refRange = record["Reference Range"]
        ?.replace(/\[cite:\s*\d+\]/g, "")
        .trim();
      const siRefInterval = record["SI Reference Interval"]
        ?.replace(/\[cite:\s*\d+\]/g, "")
        .trim();

      if (name) {
        const labValue = labValuesRepo.create({
          category: categoryName,
          name: name,
          referenceRange: refRange,
          siReferenceInterval: siRefInterval,
        });
        await labValuesRepo.save(labValue);
        totalInserted++;
      }
    }
    console.log(`Inserted ${records.length} records for ${categoryName}`);
  }

  console.log(`Successfully seeded ${totalInserted} lab values.`);
  await dataSource.destroy();
}

seedLabValues().catch((err) => {
  console.error("Error seeding lab values:", err);
  process.exit(1);
});
