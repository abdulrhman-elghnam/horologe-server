import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodType } from 'zod';

@Injectable()
export class CustomValidationPipe implements PipeTransform {
  constructor(private schema: ZodType) {}
  // Returns the parsed value, so schema transforms (trim, lowercase, defaults) reach the handler.
  // Never log `value`: it can contain passwords and tokens.
  transform(value: unknown) {
    const { success, data, error } = this.schema.safeParse(value);
    if (!success) {
      throw new BadRequestException({
        message: 'Validation Error',
        cause: {
          issues: error.issues.map((issue) => {
            return { path: issue.path, message: issue.message };
          }),
        },
      });
    }
    return data;
  }
}
