import { IsUUID, IsInt, Min, Max } from 'class-validator';

export class AddItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
