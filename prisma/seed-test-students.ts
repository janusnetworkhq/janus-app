/**
 * Idempotent, production-safe seed for 10 QA student accounts (qa.student01..10@janus.test).
 *
 *   pnpm seed:test-students            # dry run: prints target, counts and the plan; writes nothing
 *   pnpm seed:test-students --apply    # backs up affected rows to JSON, then upserts in ONE transaction
 *
 * Safety: only @janus.test emails and qa.-prefixed handles; aborts (no writes) if a handle is
 * owned by another user or an existing account is not a STUDENT; never touches append-only
 * tables (audit_events, nda_agreements) or other users. Re-running converges to the same rows.
 * Login: OTP mode, request a code then enter 123456 (built-in qa.*@janus.test test-OTP pattern).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";

type Seed = {
  n: string;
  name: string;
  handle: string;
  university: string;
  city: string;
  graduationYear: number;
  headline: string;
  bio: string;
};

const LABEL = " [QA test account]";

export const TEST_STUDENTS: Seed[] = [
  { n: "01", name: "Ananya Iyer", handle: "qa.ananya_iyer", university: "IIT Madras", city: "Chennai", graduationYear: 2027,
    headline: "B.Tech Mechanical Engineering · soft robotics & compliant grippers",
    bio: "Building low-cost soft grippers for fruit-picking robots. Robotics club lead; loves silicone casting and FEA." },
  { n: "02", name: "Rohan Deshpande", handle: "qa.rohan_deshpande", university: "COEP Technological University", city: "Pune", graduationYear: 2026,
    headline: "B.Tech Electronics & Telecommunication · low-power LoRa sensor nodes",
    bio: "Designing solar-powered LoRa nodes that report soil moisture for small farms. KiCad, STM32, a lot of field testing." },
  { n: "03", name: "Meera Krishnan", handle: "qa.meera_krishnan", university: "NIT Tiruchirappalli", city: "Tiruchirappalli", graduationYear: 2027,
    headline: "B.Tech Chemical Engineering · low-cost membrane water filters",
    bio: "Prototyping ceramic-membrane filters for rural households; measuring flux and turbidity on a home-built rig." },
  { n: "04", name: "Arnav Gupta", handle: "qa.arnav_gupta", university: "Delhi Technological University", city: "New Delhi", graduationYear: 2028,
    headline: "B.Tech Computer Engineering · on-device ML for crop disease detection",
    bio: "Training tiny CNNs that run on a ₹900 microcontroller to spot leaf blight in the field, fully offline." },
  { n: "05", name: "Sneha Reddy", handle: "qa.sneha_reddy", university: "IIIT Hyderabad", city: "Hyderabad", graduationYear: 2026,
    headline: "B.Tech Computer Science · assistive sign-language glove",
    bio: "Flex-sensor glove plus a phone app that translates Indian Sign Language gestures to speech. Hackathon winner." },
  { n: "06", name: "Kabir Malhotra", handle: "qa.kabir_malhotra", university: "BITS Pilani", city: "Pilani", graduationYear: 2027,
    headline: "B.E. Electrical & Electronics · battery management for electric two-wheelers",
    bio: "Open-source BMS with cell balancing and thermal cut-off for e-scooter packs. Formula Student electrical team." },
  { n: "07", name: "Fatima Sheikh", handle: "qa.fatima_sheikh", university: "Jamia Millia Islamia", city: "New Delhi", graduationYear: 2026,
    headline: "B.Tech Civil Engineering · fly-ash and plastic-waste bricks",
    bio: "Testing compressive strength of bricks made from fly ash and shredded plastic waste for affordable housing." },
  { n: "08", name: "Vikram Nair", handle: "qa.vikram_nair", university: "College of Engineering Trivandrum", city: "Thiruvananthapuram", graduationYear: 2027,
    headline: "B.Tech Mechanical Engineering · flood-mapping drone",
    bio: "Fixed-wing UAV with a thermal camera that maps flooded areas for rescue teams. ArduPilot and lots of foam." },
  { n: "09", name: "Ishita Banerjee", handle: "qa.ishita_banerjee", university: "Jadavpur University", city: "Kolkata", graduationYear: 2028,
    headline: "B.E. Instrumentation & Electronics · low-cost wearable ECG patch",
    bio: "Single-lead ECG patch with BLE streaming to a phone, targeting rural primary-health centres." },
  { n: "10", name: "Aditya Kulkarni", handle: "qa.aditya_kulkarni", university: "VIT Vellore", city: "Vellore", graduationYear: 2027,
    headline: "B.Tech Mechatronics · autonomous weeding robot",
    bio: "Camera-guided weeding robot for vegetable rows; ROS 2, a custom chassis and a stubborn stepper driver." },
];

const DOMAIN = "@janus.test";
const HANDLE_RE = /^[a-z0-9._]{3,30}$/;
const emailOf = (s: Seed) => `qa.student${s.n}${DOMAIN}`;

function assertSafeData() {
  const handles = new Set<string>();
  for (const s of TEST_STUDENTS) {
    const email = emailOf(s);
    if (!email.endsWith(DOMAIN)) throw new Error(`refusing non-${DOMAIN} email ${email}`);
    if (!HANDLE_RE.test(s.handle) || !s.handle.startsWith("qa.")) throw new Error(`bad handle ${s.handle}`);
    if (handles.has(s.handle)) throw new Error(`duplicate handle ${s.handle}`);
    handles.add(s.handle);
  }
}

function describeTarget(url: string | undefined): string {
  if (!url) throw new Error("DATABASE_URL is not set (refusing to guess a target)");
  const u = new URL(url);
  return `${u.hostname}:${u.port || "5432"}${u.pathname}`; // never print credentials
}

async function main() {
  const apply = process.argv.includes("--apply");
  assertSafeData();
  console.log(`[seed:test-students] target ${describeTarget(process.env.DATABASE_URL)} mode=${apply ? "APPLY" : "dry-run"}`);

  const prisma = new PrismaClient();
  try {
    const emails = TEST_STUDENTS.map(emailOf);
    const handles = TEST_STUDENTS.map((s) => s.handle);
    const [usersBefore, profilesBefore] = await Promise.all([prisma.user.count(), prisma.studentProfile.count()]);
    const existing = await prisma.user.findMany({
      where: { OR: [{ email: { in: emails } }, { handle: { in: handles } }] },
      include: { studentProfile: true },
    });

    const problems: string[] = [];
    for (const s of TEST_STUDENTS) {
      const email = emailOf(s);
      const byEmail = existing.find((u) => u.email?.toLowerCase() === email);
      const byHandle = existing.find((u) => u.handle.toLowerCase() === s.handle);
      if (byHandle && byHandle.email?.toLowerCase() !== email) problems.push(`handle ${s.handle} already used by another account`);
      if (byEmail?.role && byEmail.role !== UserRole.STUDENT) problems.push(`${email} exists with role ${byEmail.role}`);
      console.log(`  ${byEmail ? "update" : "create"}  ${email}  ${s.name}  @${s.handle}  ${s.university}`);
    }
    console.log(`  rows before: users=${usersBefore} student_profiles=${profilesBefore}; matching existing=${existing.length}`);
    if (problems.length) throw new Error(`aborting, no changes made:\n - ${problems.join("\n - ")}`);
    if (!apply) {
      console.log("dry run complete. Re-run with --apply to write.");
      return;
    }

    const dir = join(__dirname, "..", "qa-backup", "test-students");
    mkdirSync(dir, { recursive: true });
    const backup = join(dir, `pre-seed-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(backup, JSON.stringify({ target: describeTarget(process.env.DATABASE_URL), usersBefore, profilesBefore, existing }, null, 2));
    console.log(`  backup of affected rows: ${backup}`);

    const writes = TEST_STUDENTS.map((s) => {
      const email = emailOf(s);
      const profile = {
        university: s.university,
        universityNormalized: s.university.trim().toLowerCase(),
        graduationYear: s.graduationYear,
        headline: s.headline,
        bio: s.bio + LABEL,
        city: s.city,
      };
      return prisma.user.upsert({
        where: { email },
        create: {
          email,
          cognitoSub: `otp:email:${email}`,
          handle: s.handle,
          displayName: s.name,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          profileComplete: true,
          studentProfile: { create: profile },
        },
        update: {
          handle: s.handle,
          displayName: s.name,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          profileComplete: true,
          studentProfile: { upsert: { create: profile, update: profile } },
        },
        select: { id: true },
      });
    });
    const result = await prisma.$transaction(writes); // all-or-nothing
    const [usersAfter, profilesAfter] = await Promise.all([prisma.user.count(), prisma.studentProfile.count()]);
    console.log(`  upserted ${result.length} accounts; rows after: users=${usersAfter} student_profiles=${profilesAfter}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[seed:test-students] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
