// Input schemas. The app's forms validate with these and the service parses
// request bodies with the same ones, so the two never disagree about what a
// valid contact is. Optional text is "" rather than undefined, which is what
// a cleared form field sends; the service stores "" as NULL.

import { z } from "zod";
import { COMPANY_SIZES, CONTACT_STATUS_KEYS, LOGGED_KINDS, STAGE_KEYS } from "./constants";

const name = (max: number) => z.string().trim().min(1, "Required").max(max);
const text = (max: number) => z.string().trim().max(max);
const id = z.uuid().nullable();
// Yard user ids are opaque strings, not UUIDs.
const userId = z.string().min(1).max(128).nullable();
const time = z.number().int().nonnegative().nullable();

export const companySchema = z.object({
  name: name(120),
  domain: text(120),
  industry: text(60),
  size: z.enum(COMPANY_SIZES).nullable(),
  owner_id: userId,
});

export const contactSchema = z.object({
  first_name: name(60),
  last_name: text(60),
  email: z.union([z.literal(""), z.email("Enter a valid email").max(254)]),
  phone: text(40),
  title: text(80),
  status: z.enum(CONTACT_STATUS_KEYS),
  company_id: id,
  owner_id: userId,
});

export const dealSchema = z.object({
  title: name(120),
  value: z.number("Enter an amount").int().min(0).max(1_000_000_000),
  stage: z.enum(STAGE_KEYS),
  company_id: id,
  contact_id: id,
  owner_id: userId,
  expected_close_at: time,
});

export const dealMoveSchema = z.object({
  stage: z.enum(STAGE_KEYS),
  position: z.number().finite(),
});

export const taskSchema = z.object({
  title: name(200),
  due_at: time,
  assignee_id: userId,
  contact_id: id,
  company_id: id,
  deal_id: id,
});

export const taskPatchSchema = taskSchema.partial().extend({ done: z.boolean().optional() });

export const activitySchema = z.object({
  kind: z.enum(LOGGED_KINDS),
  body: name(4000),
  contact_id: id.optional(),
  company_id: id.optional(),
  deal_id: id.optional(),
});

export const workspaceSchema = z.object({ name: name(60) });
export const profileSchema = z.object({ name: name(40) });
export const roleSchema = z.object({ role: z.enum(["admin", "member"]) });

export type CompanyInput = z.infer<typeof companySchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type DealInput = z.infer<typeof dealSchema>;
export type DealMove = z.infer<typeof dealMoveSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type TaskPatch = z.infer<typeof taskPatchSchema>;
export type ActivityInput = z.infer<typeof activitySchema>;
