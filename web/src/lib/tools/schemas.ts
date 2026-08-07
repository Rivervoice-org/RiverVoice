import { z } from "zod";

const pair = z.object({
  id: z.number(),
  key: z.string(),
  value: z.string(),
});

// Named like a function, because that is what the model sees it as.
const toolName = z
  .string()
  .trim()
  .min(1, "Give the tool a name")
  .max(64, "Name is too long")
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase words joined by underscores, like get_order_status");

const describes = {
  name: toolName,
  description: z.string().trim().min(1, "Describe what this tool does").max(500),
  when: z.enum(["start", "during", "end"]),
  responseTemplate: z.string().trim().max(500),
  keepAvailable: z.boolean(),
  mappings: z.array(pair),
};

export const apiToolSchema = z
  .object({
    ...describes,
    source: z.enum(["curl", "manual"]),
    curl: z.string(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    url: z.string(),
    params: z.array(pair),
    headers: z.array(pair),
    auth: z.string(),
    body: z.string(),
    maxWait: z.number().int().min(1, "At least 1 second").max(60, "At most 60 seconds"),
    failureMessage: z.string().trim().max(500),
  })
  // Only one half of the section is filled in, so only that half is required.
  .superRefine((values, ctx) => {
    if (values.source === "curl") {
      if (!values.curl.trim()) {
        ctx.addIssue({ code: "custom", path: ["curl"], message: "Paste a cURL command" });
      }
      return;
    }

    if (!z.url().safeParse(values.url).success) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a URL, including https://" });
    }
  });

export const mockToolSchema = z.object({
  ...describes,
  responseBody: z
    .string()
    .trim()
    .min(1, "Write the reply the agent should get")
    .refine((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    }, "This is not valid JSON"),
  statusCode: z.number().int().min(100, "Not a status code").max(599, "Not a status code"),
  delaySeconds: z.number().int().min(0).max(30, "At most 30 seconds"),
  realUrl: z.union([z.literal(""), z.url("Enter a URL, including https://")]),
});

export type ApiToolValues = z.infer<typeof apiToolSchema>;
export type MockToolValues = z.infer<typeof mockToolSchema>;

export const apiToolDefaults: ApiToolValues = {
  name: "",
  description: "",
  when: "during",
  source: "curl",
  curl: "",
  method: "POST",
  url: "",
  params: [],
  headers: [],
  auth: "",
  body: "",
  responseTemplate: "",
  maxWait: 30,
  failureMessage: "",
  keepAvailable: true,
  mappings: [],
};

export const mockToolDefaults: MockToolValues = {
  name: "",
  description: "",
  when: "during",
  responseBody: "",
  statusCode: 200,
  delaySeconds: 0,
  responseTemplate: "",
  realUrl: "",
  keepAvailable: true,
  mappings: [],
};
