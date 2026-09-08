import { z } from "zod";
import { ORDER_STATUSES, ROLES, SHOP_STATUSES } from "./types";

/** Sri Lankan mobile numbers, stored as entered but normalised for lookup. */
export const phoneSchema = z
  .string()
  .trim()
  .min(9, "Please enter a valid mobile number.")
  .max(15, "Please enter a valid mobile number.")
  .regex(/^\+?[0-9\s-]+$/, "Please enter a valid mobile number.");

export function normalisePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  phone: phoneSchema,
  email: z.string().trim().email("Please enter a valid email address.").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters."),
  address: z
    .object({
      label: z.string().trim().min(1).max(40).default("Home"),
      address: z.string().trim().min(5, "Please enter the address details."),
      area: z.string().trim().max(80).optional().or(z.literal("")),
      landmark: z.string().trim().max(120).optional().or(z.literal("")),
    })
    .optional(),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Please enter your password."),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal("")),
});

export const addressSchema = z.object({
  label: z.string().trim().min(1, "Please name this address.").max(40),
  address: z.string().trim().min(5, "Please enter the address details."),
  area: z.string().trim().max(80).optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  phone: phoneSchema.optional().or(z.literal("")),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
});

export const createOrderSchema = z.object({
  address_id: z.coerce.number().int().positive("Please select a pickup address."),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please select a valid pickup date."),
  pickup_time_slot: z.string().trim().min(3, "Please choose a pickup time slot."),
  bag_count: z.coerce.number().int().min(1, "Please enter at least one bag.").max(50),
  item_count: z.coerce.number().int().min(0).max(500).nullable().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const pickupSchema = z.object({
  actual_bag_count: z.coerce.number().int().min(1).max(50).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const deliverSchema = z.object({
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const shopStatusSchema = z.object({
  status: z.enum(SHOP_STATUSES),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const priceSchema = z.object({
  price: z.coerce.number().min(0, "Please enter a valid price.").max(1_000_000),
});

export const assignAgentSchema = z.object({
  agent_id: z.coerce.number().int().positive("Please choose an agent."),
  type: z.enum(["pickup", "delivery"]).default("pickup"),
});

export const createAgentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(ROLES).default("PICKUP_AGENT"),
  shop_id: z.coerce.number().int().positive().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  password: z.string().min(6).optional().or(z.literal("")),
  is_active: z.coerce.boolean().optional(),
  shop_id: z.coerce.number().int().positive().nullable().optional(),
});

export const shopSchema = z.object({
  name: z.string().trim().min(2, "Please enter the shop name.").max(80),
  phone: phoneSchema.optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const routeSchema = z.object({
  name: z.string().trim().max(60).optional().or(z.literal("")),
  agent_id: z.coerce.number().int().positive("Please choose an agent."),
  route_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please select a valid date."),
  order_ids: z.array(z.coerce.number().int().positive()).min(1, "Select at least one order for the route."),
});

export const statusFilterSchema = z.enum(ORDER_STATUSES);

/** Turns a ZodError into the first human-readable message. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the information you entered.";
}
