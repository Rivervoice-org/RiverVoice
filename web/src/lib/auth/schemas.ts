import { z } from "zod";

// Mirrors harbor's rules, so the browser catches what the server would reject.
export const signUpSchema = z
  .object({
    organizationName: z.string().trim().min(2, "Company name is too short").max(100),
    userName: z.string().trim().min(2, "Enter your name").max(100),
    email: z.email("Email is incorrect"),
    phoneNumber: z
      .string()
      .regex(/^\+91[6-9]\d{9}$/, "Enter an Indian mobile number, like +919845022118"),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.email("Email is incorrect"),
  password: z.string().min(1, "Password is required"),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;
