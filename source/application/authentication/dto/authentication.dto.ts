import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
  buildMessage,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';


const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);


const MaxBytes = (max: number, options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'maxBytes',
      constraints: [max],
      validator: {
        validate: (value: unknown) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= max,
        defaultMessage: buildMessage((prefix: string) => `${prefix}$property must be at most $constraint1 bytes`, options),
      },
    },
    options,
  );


const NotEqualTo = (property: string, options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'notEqualTo',
      constraints: [property],
      validator: {
        validate: (value: unknown, args?: ValidationArguments) => value !== (args?.object as Record<string, unknown> | undefined)?.[property],
        defaultMessage: buildMessage((prefix: string) => `${prefix}$property must differ from $constraint1`, options),
      },
    },
    options,
  );


const NewPassword = (): PropertyDecorator => (target, key) => {
  IsString()(target, key);
  MinLength(8)(target, key);
  MaxBytes(72)(target, key);
  Matches(/^(?=.*[A-Za-z])(?=.*\d)/, { message: 'password must contain at least one letter and one number' })(target, key);
};


const Email = (): PropertyDecorator => (target, key) => {
  Transform(trimLower)(target, key);
  IsEmail()(target, key);
  MaxLength(254)(target, key);
};


const RequiredText =
  (max: number): PropertyDecorator =>
  (target, key) => {
    Transform(trim)(target, key);
    IsString()(target, key);
    IsNotEmpty()(target, key);
    MaxLength(max)(target, key);
  };

export class RegisterDto {
  @RequiredText(120)
  name!: string;

  @Email()
  email!: string;

  @NewPassword()
  password!: string;

  @RequiredText(120)
  city!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9\s-]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;
}

export class LoginDto {
  @Email()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class EmailDto {
  @Email()
  email!: string;
}

export class VerifyEmailDto extends EmailDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp must be 6 digits' })
  otp!: string;
}

export class ResetPasswordDto {
  /** 32 random bytes, base64url-encoded. */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'token is invalid' })
  token!: string;

  @NewPassword()
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;

  @NewPassword()
  @NotEqualTo('currentPassword')
  newPassword!: string;
}

export class GoogleCredentialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  idToken!: string;

  @RequiredText(120)
  city!: string;
}
