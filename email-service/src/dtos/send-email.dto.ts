import { z } from "zod";

export const SendEmailDtoSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  template: z.string().min(1),
  data: z.record(z.any()).default({}),
});

export type SendEmailDto = z.infer<typeof SendEmailDtoSchema>;
