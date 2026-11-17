import { Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  couponCreateSchema,
  couponUpdateSchema,
  type CouponCreateInput,
  type CouponUpdateInput,
} from '@briefluence/shared';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Roles } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { CouponsService } from './coupons.service';

/** Admin → Coupons: Paddle discounts created and watched from our dashboard. */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list() {
    return this.coupons.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.coupons.get(id);
  }

  @Post()
  @ApiZodBody(couponCreateSchema)
  create(@CurrentUser() user: AuthUser, @ZodBody(couponCreateSchema) body: CouponCreateInput) {
    return this.coupons.create(body, user.id);
  }

  @Patch(':id')
  @ApiZodBody(couponUpdateSchema)
  update(@Param('id') id: string, @ZodBody(couponUpdateSchema) body: CouponUpdateInput) {
    return this.coupons.setActive(id, body.active);
  }
}
