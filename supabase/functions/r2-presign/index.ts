import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// S3v4 presigning implementation
const encoder = new TextEncoder();

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSigningKey(
  secretKey: string, dateStamp: string, region: string, service: string
): Promise<ArrayBuffer> {
  let key = await hmacSha256(encoder.encode("AWS4" + secretKey).buffer, dateStamp);
  key = await hmacSha256(key, region);
  key = await hmacSha256(key, service);
  key = await hmacSha256(key, "aws4_request");
  return key;
}

async function presignUrl(
  method: string,
  endpoint: string,
  bucket: string,
  key: string,
  accessKeyId: string,
  secretAccessKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const datePart = dateStamp.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const credential = `${accessKeyId}/${datePart}/${region}/${service}/aws4_request`;

  const host = new URL(endpoint).host;
  const path = `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;

  const params = new URLSearchParams();
  params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  params.set("X-Amz-Credential", credential);
  params.set("X-Amz-Date", dateStamp);
  params.set("X-Amz-Expires", String(expiresIn));
  params.set("X-Amz-SignedHeaders", "host");

  // Sort params for canonical query string
  const sortedParams = new URLSearchParams([...params.entries()].sort());
  const canonicalQueryString = sortedParams.toString();

  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateStamp,
    `${datePart}/${region}/${service}/aws4_request`,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await getSigningKey(secretAccessKey, datePart, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  return `${endpoint}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const R2_ACCESS_KEY = Deno.env.get("R2_ACCESS_KEY_ID")!;
    const R2_SECRET_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
    const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT")!;
    const BUCKET = "scriptlift-media";

    const { action, key, contentType } = await req.json();

    if (!action || !key) {
      return new Response(
        JSON.stringify({ error: "Missing action or key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "upload") {
      const url = await presignUrl("PUT", R2_ENDPOINT, BUCKET, key, R2_ACCESS_KEY, R2_SECRET_KEY);
      return new Response(
        JSON.stringify({ url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "download") {
      const url = await presignUrl("GET", R2_ENDPOINT, BUCKET, key, R2_ACCESS_KEY, R2_SECRET_KEY);
      return new Response(
        JSON.stringify({ url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const url = await presignUrl("DELETE", R2_ENDPOINT, BUCKET, key, R2_ACCESS_KEY, R2_SECRET_KEY);
      const resp = await fetch(url, { method: "DELETE" });
      return new Response(
        JSON.stringify({ success: resp.ok }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use upload, download, or delete." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("R2 presign error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
