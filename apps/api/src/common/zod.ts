import { applyDecorators, Body, PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';
import { AppError } from './app-error';

export class ZodPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.output<T> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 'Invalid input', z.flattenError(parsed.error));
    }
    return parsed.data;
  }
}

function jsonSchema(schema: z.ZodType) {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  } catch {
    return { type: 'object' };
  }
}

/** Validates the request body with a shared Zod schema and documents it in Swagger. */
export const ZodBody = (schema: z.ZodType): ParameterDecorator => Body(new ZodPipe(schema));
export const ApiZodBody = (schema: z.ZodType) => applyDecorators(ApiBody({ schema: jsonSchema(schema) }));
export const ZodQuery = (schema: z.ZodType): ParameterDecorator => Query(new ZodPipe(schema));
export const ApiZodQuery = (name: string) => ApiQuery({ name, required: false });
