import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class SyncFileDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    default: '651d0a5d785c77b0dac60170',
  })
  readonly organizationId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    default: '651d0a5d785c77b0dac60171',
  })
  readonly templateId: string;

  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1, { message: 'Paths must contain at least 1 elements !' })
  @ApiProperty({ type: [String] })
  readonly paths: string[];
}
