import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import * as https from "https";
import * as http from "http";
import { MEDIA_PROXY_THROTTLE } from "../rate-limit/rate-limit.constants";

const ALLOWED_HOSTS = [
  "storage-public.medpark.io",
  "storage.blablabl234a.online"
];

@Controller("media")
export class MediaProxyController {
  @Get("proxy")
  @Throttle(MEDIA_PROXY_THROTTLE)
  proxyImage(@Query("url") url: string, @Res() res: Response) {
    if (!url) throw new BadRequestException("Missing url parameter");

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException("Invalid url");
    }

    // Only allow proxying from our own storage buckets
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      throw new BadRequestException("URL not allowed");
    }

    const transport = parsed.protocol === "https:" ? https : http;

    transport
      .get(
        url,
        {
          headers: {
            // No referrer so the bucket doesn't block us
            Referer: "",
            "User-Agent": "MedPark/1.0",
          },
        },
        (upstream) => {
          res.setHeader(
            "Content-Type",
            upstream.headers["content-type"] || "image/jpeg",
          );
          res.setHeader("Cache-Control", "public, max-age=86400");
          // Allow the browser to use the response in canvas
          res.setHeader("Access-Control-Allow-Origin", "*");
          upstream.pipe(res);
        },
      )
      .on("error", (err) => {
        console.error("[MediaProxy] fetch error:", err);
        res.status(502).json({ message: "Failed to fetch media" });
      });
  }
}
