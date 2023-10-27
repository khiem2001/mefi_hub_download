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
  @ApiProperty({
    default: '651d0a5d785c77b0dac60170',
  })
  @IsNotEmpty({ message: 'Organization ID should not be empty !' })
  @IsMongoId({ message: 'Organization ID format is incorrect !' })
  readonly organizationId: string;

  @ApiProperty({ default: '651d0a5d785c77b0dac60171' })
  @IsNotEmpty({ message: 'Template ID should not be empty !' })
  @IsMongoId({ message: 'Template ID format is incorrect !' })
  readonly templateId: string;

  @IsArray()
  @ApiProperty()
  @ArrayMinSize(1, { message: 'At least one URL must be provided' })
  @Validate(URLValidator)
  readonly urls: string[];
}
