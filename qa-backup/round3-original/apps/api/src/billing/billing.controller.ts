import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OrgPlan } from "@prisma/client";
import { CurrentUser, RequiresProfile } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";

@ApiTags("billing")
@ApiBearerAuth()
@RequiresProfile()
@Controller("v1/billing")
export class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("plan")
  async plan(@CurrentUser() user: AuthedUser) {
    const recruiter = await this.prisma.recruiterProfile.findUnique({
      where: { userId: user.id },
      select: { org: { select: { id: true, name: true, slug: true, plan: true, status: true } } },
    });
    return {
      plan: recruiter?.org.plan ?? OrgPlan.FREE_PILOT,
      monetization: "stub",
      organization: recruiter?.org ?? null,
    };
  }
}
