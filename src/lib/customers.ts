import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentTypes, contents, contracts, customers } from "@/db/schema";
import { compareCodes } from "./content-rules";

export type ContractRow = { id: string; startMonth: string; endMonth: string };

/** All contracts of a customer, newest first. The first one is the current contract. */
export async function contractsOf(customerId: string): Promise<ContractRow[]> {
  return db
    .select({ id: contracts.id, startMonth: contracts.startMonth, endMonth: contracts.endMonth })
    .from(contracts)
    .where(eq(contracts.customerId, customerId))
    .orderBy(desc(contracts.startMonth), desc(contracts.createdAt));
}

export async function customerList(includeArchived: boolean) {
  return db
    .select({ id: customers.id, name: customers.name, color: customers.color, archived: customers.archived })
    .from(customers)
    .where(includeArchived ? undefined : eq(customers.archived, false))
    .orderBy(asc(customers.archived), asc(customers.name));
}

/** A customer's content IDs: active ones first, then by ID in counting order (…-2 before …-10). */
export async function contentsOf(customerId: string) {
  const rows = await db
    .select({
      id: contents.id,
      code: contents.code,
      archived: contents.archived,
      contentTypeId: contents.contentTypeId,
      typeName: contentTypes.name,
      typeCode: contentTypes.code,
      contractId: contents.contractId,
    })
    .from(contents)
    .innerJoin(contentTypes, eq(contentTypes.id, contents.contentTypeId))
    .where(eq(contents.customerId, customerId));
  return rows.sort((a, b) => Number(a.archived) - Number(b.archived) || compareCodes(a.code, b.code));
}

export async function activeContentTypes() {
  return db
    .select({ id: contentTypes.id, code: contentTypes.code, name: contentTypes.name })
    .from(contentTypes)
    .where(eq(contentTypes.archived, false))
    .orderBy(asc(contentTypes.createdAt));
}

export async function isContentTypeInUse(contentTypeId: string) {
  return (await db.$count(contents, and(eq(contents.contentTypeId, contentTypeId)))) > 0;
}
