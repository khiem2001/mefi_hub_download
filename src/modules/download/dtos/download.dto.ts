import { ArrayMinSize, IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class CreateMediaFromUrlDto {
  @IsNotEmpty({ message: 'Organization ID should not be empty !' })
  @IsMongoId({ message: 'Organization ID format is incorrect !' })
  organizationId: string;

  @IsNotEmpty({ message: ' ID should not be empty !' })
  @IsMongoId({ message: ' ID format is incorrect !' })
  templateId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one URL must be provided' })
  urls: string[];
}
