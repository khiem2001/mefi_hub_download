import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  Validate,
} from 'class-validator';
import { URLValidator } from 'common/validator/url.validator';

export class CreateMediaFromUrlDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Organization ID should not be empty !' })
  @IsMongoId({ message: 'Organization ID format is incorrect !' })
  organizationId: string;

  @ApiProperty()
  @IsNotEmpty({ message: ' ID should not be empty !' })
  @IsMongoId({ message: ' ID format is incorrect !' })
  templateId: string;

  @IsArray()
  @ApiProperty()
  @ArrayMinSize(1, { message: 'At least one URL must be provided' })
  @Validate(URLValidator)
  urls: string[];
}
