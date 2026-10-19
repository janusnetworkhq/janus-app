import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OrgPlan } from "@prisma/client";
import { CurrentUser, RequiresProfile } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { monthStartUtc, PLANS } from "./plans";

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
    const planId = recruiter?.org.plan ?? OrgPlan.FREE_PILOT;
    const monthStart = monthStartUtc();
    const used = recruiter
      ? await this.prisma.ndaRequest.count({
          where: { createdAt: { gte: monthStart }, recruiter: { recruiterProfile: { orgId: recruiter.org.id } } },
        })
      : 0;
    const seatsUsed = recruiter
      ? await this.prisma.recruiterProfile.count({ where: { orgId: recruiter.org.id } })
      : 0;
    return {
      plan: planId,
      details: PLANS[planId],
      usage: { ndaRequestsThisMonth: used, seatsUsed },
      monetization: "stub",
      organization: recruiter?.org ?? null,
    };
  }

  @Get("plans")
  plans() {
    return { items: Object.values(PLANS) };
  }
}
