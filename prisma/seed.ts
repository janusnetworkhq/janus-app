import { createHash } from "node:crypto";
import { PrismaClient, UserRole, UserStatus, ModerationStatus, VideoStatus, VideoVisibility, VaultAssetKind } from "@prisma/client";

const prisma = new PrismaClient();

const NDA_BODY = `JANUS MUTUAL NON-DISCLOSURE AGREEMENT (PILOT)

This agreement governs access to a student innovator's protected materials (the "Vault"), including schematics, source archives, documents, and high-resolution recordings.

1. Purpose. The Recruiter requests access solely to evaluate the Student for a potential role or engagement.

2. Confidentiality. The Recruiter shall not copy, redistribute, reverse-engineer, or publish Vault materials, nor use them to build a competing product.

3. Term. Access lasts seven (7) days from signature unless revoked earlier by the Student.

4. Evidence. JANUS records signer name, template hash, IP address, user agent, and a PDF snapshot at the time of signature.

5. Governing note. This pilot instrument is intended to satisfy basic evidentiary requirements under the Information Technology Act, 2000. It is not a substitute for counsel-reviewed enterprise paper.

By typing their legal name, the Recruiter confirms they have read this text in full and accept these terms.
`;

const SAMPLE_PROJECTS = [
  {
    name: "Arjun Mehta",
    handle: "arjun.robotics",
    email: "arjun@iitm.ac.in",
    university: "IIT Madras",
    headline: "Autonomous Wildfire Detection Drone with Thermal Edge AI",
    city: "Chennai",
    caption: "Field testing our autonomous hexacopter equipped with custom thermal camera sensors and onboard YOLO edge AI to spot smoldering wildfires within seconds.",
    likes: 342,
    comments: 48,
    saves: 89,
    hasVault: true,
    vaultFileName: "thermal_flight_controller_schematics.pdf",
    vaultFileType: "application/pdf",
    posterUrl: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    name: "Sarah Chen",
    handle: "sarah.bms",
    email: "schen@stanford.edu",
    university: "Stanford University",
    headline: "Low-Cost Smart Battery Management System for 2-Wheeler EVs",
    city: "Palo Alto",
    caption: "Designed a 48V modular BMS with cell-level impedance tracking. Achieved 99.2% balancing efficiency at 1/4th the bill of materials cost.",
    likes: 512,
    comments: 63,
    saves: 145,
    hasVault: true,
    vaultFileName: "bms_firmware_and_pcb_gerber.zip",
    vaultFileType: "application/zip",
    posterUrl: "https://images.unsplash.com/photo-1558441719-8b489c63f7d1?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  },
  {
    name: "Vikram Kulkarni",
    handle: "vikram.ai",
    email: "vikram@nitk.edu.in",
    university: "NIT Karnataka",
    headline: "Solar-Powered Desalination Device with Microfluidic Evaporator",
    city: "Mangaluru",
    caption: "Demo of our 3D printed portable solar desalinator. Produces 4.2 liters of potable drinking water per square meter per hour using passive capillary action.",
    likes: 420,
    comments: 39,
    saves: 110,
    hasVault: true,
    vaultFileName: "solar_evaporator_cad_and_water_test_report.pdf",
    vaultFileType: "application/pdf",
    posterUrl: "https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
  {
    name: "Elena Rostova",
    handle: "elena.bionics",
    email: "elena@mit.edu",
    university: "MIT",
    headline: "EMG-Controlled 6-Axis Bionic Prosthetic Arm with Haptic Touch",
    city: "Cambridge",
    caption: "Testing sub-50ms latency finger articulation using surface electromyography sensors and custom harmonic micro-gearboxes. Closed-loop vibrotactile feedback works!",
    likes: 890,
    comments: 112,
    saves: 320,
    hasVault: true,
    vaultFileName: "bionic_hand_mechanical_cad_fusion360.zip",
    vaultFileType: "application/zip",
    posterUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  },
  {
    name: "Karthik Nair",
    handle: "karthik.agritech",
    email: "karthik@iitb.ac.in",
    university: "IIT Bombay",
    headline: "Vision-Guided Selective Weed Eradication Rover",
    city: "Mumbai",
    caption: "Our autonomous field rover distinguishes between crop seedlings and invasive weeds at 5km/h, micro-dosing bio-herbicide with 98% pinpoint accuracy.",
    likes: 275,
    comments: 31,
    saves: 72,
    hasVault: false,
    posterUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    name: "Priya Sundaram",
    handle: "priya.biotech",
    email: "priya@berkeley.edu",
    university: "UC Berkeley",
    headline: "Handheld Biosensor for Rapid Waterborne Pathogen Screening",
    city: "Berkeley",
    caption: "Fluorescence immunoassay optical reader plugged into a smartphone. Detects E. coli and Vibrio in river samples in under 12 minutes.",
    likes: 630,
    comments: 54,
    saves: 180,
    hasVault: true,
    vaultFileName: "microfluidic_chip_optics_schematics.pdf",
    vaultFileType: "application/pdf",
    posterUrl: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  },
  {
    name: "Rohan Patel",
    handle: "rohan.chips",
    email: "rohan@gatech.edu",
    university: "Georgia Tech",
    headline: "Open-Source RISC-V Neural Acceleration Core in 28nm",
    city: "Atlanta",
    caption: "Synthesized and verified a 4-core systolic array accelerator optimized for int8 transformer inference. Consumes just 120mW under full compute load.",
    likes: 740,
    comments: 88,
    saves: 260,
    hasVault: true,
    vaultFileName: "verilog_source_and_synthesis_benchmarks.zip",
    vaultFileType: "application/zip",
    posterUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
  },
  {
    name: "Ananya Deshmukh",
    handle: "ananya.aerospace",
    email: "ananya@iitk.ac.in",
    university: "IIT Kanpur",
    headline: "Variable Pitch Quad-Tiltrotor VTOL UAV for Cargo Delivery",
    city: "Kanpur",
    caption: "Transition flight demo: Seamless conversion from hover mode to aerodynamic forward cruising flight with a 3.5kg medical delivery payload.",
    likes: 410,
    comments: 42,
    saves: 95,
    hasVault: true,
    vaultFileName: "aerodynamic_cfd_analysis_and_airframe_cad.pdf",
    vaultFileType: "application/pdf",
    posterUrl: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  },
  {
    name: "Liam O'Connor",
    handle: "liam.quantum",
    email: "liam@ox.ac.uk",
    university: "University of Oxford",
    headline: "Cryogenic CMOS Microwave Multiplexer for Qubit Readout",
    city: "Oxford",
    caption: "Operation verified at 4 Kelvin! Scaled 64-channel dispersive readout pipeline with noise temperature below 1.2K.",
    likes: 580,
    comments: 72,
    saves: 190,
    hasVault: true,
    vaultFileName: "cryo_pcb_cad_and_s_parameter_data.zip",
    vaultFileType: "application/zip",
    posterUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
  },
  {
    name: "Neha Gupta",
    handle: "neha.cleantech",
    email: "neha@iitd.ac.in",
    university: "IIT Delhi",
    headline: "Direct Air Carbon Capture Micro-Reactor with Nanoporous MOF",
    city: "New Delhi",
    caption: "Testing our low-temperature desorbing metal-organic framework bed. Demonstrated 2.8 mmol CO2 per gram capture capacity using ambient air.",
    likes: 380,
    comments: 45,
    saves: 84,
    hasVault: true,
    vaultFileName: "chemical_synthesis_protocol_and_pfd.pdf",
    vaultFileType: "application/pdf",
    posterUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    name: "Marcus Vance",
    handle: "marcus.cmu",
    email: "mvance@cmu.edu",
    university: "Carnegie Mellon University",
    headline: "Quadruped Locomotion Controller on Slippery and Deformable Terrain",
    city: "Pittsburgh",
    caption: "Reinforcement learning model predicting ground reaction forces in real time. Our robot negotiates muddy inclines without slipping.",
    likes: 920,
    comments: 135,
    saves: 340,
    hasVault: false,
    posterUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  },
  {
    name: "Divya Balaji",
    handle: "divya.circuits",
    email: "divya@iisc.ac.in",
    university: "IISc Bengaluru",
    headline: "Ultra-Low Power Photonic Neuromorphic Computing Chip",
    city: "Bengaluru",
    caption: "Demonstrated matrix-vector multiplication with silicon microring resonators at 10 GHz with energy consumption below 0.3 femtojoules per MAC.",
    likes: 670,
    comments: 58,
    saves: 215,
    hasVault: true,
    vaultFileName: "photonic_ic_layout_gdsii_extract.zip",
    vaultFileType: "application/zip",
    posterUrl: "https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
  {
    name: "Kenji Sato",
    handle: "kenji.robotics",
    email: "kenji@u-tokyo.ac.jp",
    university: "University of Tokyo",
    headline: "Tendon-Driven Soft Gripper for Fragile Agricultural Produce",
    city: "Tokyo",
    caption: "Pneumatic-tendon hybrid soft robotics gripper delicately harvesting ripe strawberries without surface bruising at 1 pick every 2.4 seconds.",
    likes: 490,
    comments: 61,
    saves: 130,
    hasVault: true,
    vaultFileName: "silicone_molding_cad_and_pressure_control_code.zip",
    vaultFileType: "application/zip",
    posterUrl: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  },
  {
    name: "Sneha Reddy",
    handle: "sneha.iot",
    email: "sneha@iiith.ac.in",
    university: "IIIT Hyderabad",
    headline: "Decentralized Smart Grid Energy Trading Protocol with Zero-Knowledge",
    city: "Hyderabad",
    caption: "Live testbed: 18 solar micro-producers executing peer-to-peer electricity swaps with cryptographic proof of delivery under 800ms.",
    likes: 310,
    comments: 29,
    saves: 88,
    hasVault: false,
    posterUrl: "https://images.unsplash.com/photo-1508873696983-2df5703bc20d?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    name: "Alexander Becker",
    handle: "alex.eth",
    email: "abecker@ethz.ch",
    university: "ETH Zurich",
    headline: "Autonomous Glider with Thermal Updraft Soaring Algorithms",
    city: "Zurich",
    caption: "Completed a 6-hour autonomous flight without motor thrust by detecting atmospheric thermals using barometric gradient machine learning.",
    likes: 720,
    comments: 80,
    saves: 230,
    hasVault: true,
    vaultFileName: "soaring_autopilot_matlab_and_firmware.zip",
    vaultFileType: "application/zip",
    posterUrl: "https://images.unsplash.com/photo-1519074069444-1ba4ee16e6f7?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  },
  {
    name: "Fatima Al-Mansoor",
    handle: "fatima.chem",
    email: "fatima@nus.edu.sg",
    university: "National University of Singapore",
    headline: "Recycled PET Plastic to High-Capacity Porous Supercapacitor Electrodes",
    city: "Singapore",
    caption: "Chemical upcycling of single-use drink bottles into active carbon electrodes achieving 310 F/g specific capacitance and 10,000 cycle stability.",
    likes: 450,
    comments: 50,
    saves: 115,
    hasVault: true,
    vaultFileName: "carbonization_process_patent_draft.pdf",
    vaultFileType: "application/pdf",
    posterUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
  },
  {
    name: "Aditya Roy",
    handle: "aditya.embedded",
    email: "aditya@iitr.ac.in",
    university: "IIT Roorkee",
    headline: "Sub-surface Radar for Groundwater Table & Soil Moisture Profiling",
    city: "Roorkee",
    caption: "Built an ultra-wideband ground penetrating radar module operating from 500MHz to 2.5GHz with custom antenna array for smart irrigation feedback.",
    likes: 360,
    comments: 38,
    saves: 92,
    hasVault: true,
    vaultFileName: "rf_antenna_vna_measurements_and_gerber.pdf",
    vaultFileType: "application/pdf",
    posterUrl: "https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  },
  {
    name: "Chloe Dupont",
    handle: "chloe.neuro",
    email: "chloe@cam.ac.uk",
    university: "University of Cambridge",
    headline: "Wearable EEG Headband for Focus Tracking and Neurofeedback",
    city: "Cambridge",
    caption: "3-channel dry electrode system with active noise suppression. Accurately predicts cognitive fatigue states 15 minutes before user perception.",
    likes: 540,
    comments: 67,
    saves: 175,
    hasVault: true,
    vaultFileName: "analog_front_end_schematics_and_raw_eeg_dataset.zip",
    vaultFileType: "application/zip",
    posterUrl: "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
  },
  {
    name: "Siddharth Joshi",
    handle: "sid.autonomous",
    email: "sid@bits-pilani.ac.in",
    university: "BITS Pilani",
    headline: "Solid-State LiDAR Sensor with MEMS Scanning Mirror",
    city: "Pilani",
    caption: "Designed a 905nm pulsed laser MEMS LiDAR with 80-meter range and 0.1 degree angular resolution, packaged in a 6x6cm enclosure.",
    likes: 610,
    comments: 52,
    saves: 165,
    hasVault: true,
    vaultFileName: "mems_driver_circuit_and_pointcloud_eval.pdf",
    vaultFileType: "application/pdf",
    posterUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    name: "Grace Hopper Jr",
    handle: "grace.systems",
    email: "grace@caltech.edu",
    university: "Caltech",
    headline: "Self-Balancing Electric Unicycle with Active Gyroscopic Assist",
    city: "Pasadena",
    caption: "Dual reaction wheel inertial stabilization combined with Kalman state estimator. Capable of zero-speed stationary balance on uneven terrain.",
    likes: 810,
    comments: 94,
    saves: 280,
    hasVault: false,
    posterUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  },
  {
    name: "Manish Singhania",
    handle: "manish.solar",
    email: "manish@iitg.ac.in",
    university: "IIT Guwahati",
    headline: "Flexible Perovskite Photovoltaic Film with 21.4% Efficiency",
    city: "Guwahati",
    caption: "Roll-to-roll slot-die coated perovskite on flexible polymer substrate. Maintained 92% initial efficiency after 1,500 bending cycles.",
    likes: 470,
    comments: 44,
    saves: 125,
    hasVault: true,
    vaultFileName: "jv_curves_and_chemical_degradation_test_data.pdf",
    vaultFileType: "application/pdf",
    posterUrl: "https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
  {
    name: "Zoe Williams",
    handle: "zoe.vision",
    email: "zwilliams@uwaterloo.ca",
    university: "University of Waterloo",
    headline: "Real-Time 3D Spatial Audio Synthesis for AR Visually Impaired Aid",
    city: "Waterloo",
    caption: "Converts stereoscopic depth video into intuitive acoustic spatial beacons running at 60 FPS on edge mobile hardware.",
    likes: 560,
    comments: 70,
    saves: 195,
    hasVault: true,
    vaultFileName: "binaural_hrtf_dsp_c_plus_plus_library.zip",
    vaultFileType: "application/zip",
    posterUrl: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  },
];

async function main() {
  const prodSeed = process.env.SEED_MODE === "prod" || process.env.NODE_ENV === "production";
  if (prodSeed) {
    // Clean production seed: NDA template + optional admin bootstrap only. No demo users/videos.
    const contentSha256 = createHash("sha256").update(NDA_BODY, "utf8").digest("hex");
    await prisma.ndaTemplate.upsert({
      where: { version: 1 },
      update: { title: "JANUS Mutual Non-Disclosure Agreement v1", body: NDA_BODY, contentSha256, isActive: true },
      create: { version: 1, title: "JANUS Mutual Non-Disclosure Agreement v1", body: NDA_BODY, contentSha256, isActive: true },
    });
    const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    if (adminEmail) {
      await prisma.user.upsert({
        where: { email: adminEmail },
        update: { role: UserRole.PLATFORM_ADMIN, status: UserStatus.ACTIVE, profileComplete: true },
        create: {
          cognitoSub: process.env.ADMIN_BOOTSTRAP_SUB ?? `bootstrap:admin:${adminEmail}`,
          email: adminEmail, handle: "janus_admin", displayName: "Janus Admin",
          role: UserRole.PLATFORM_ADMIN, status: UserStatus.ACTIVE, profileComplete: true,
        },
      });
      console.log(`Prod seed: NDA template + admin bootstrap (${adminEmail})`);
    } else {
      console.log("Prod seed: NDA template only (ADMIN_BOOTSTRAP_EMAIL unset)");
    }
    return;
  }
  console.log("Seeding NDA template...");
  const contentSha256 = createHash("sha256").update(NDA_BODY, "utf8").digest("hex");

  await prisma.ndaTemplate.upsert({
    where: { version: 1 },
    update: {
      title: "JANUS Mutual Non-Disclosure Agreement v1",
      body: NDA_BODY,
      contentSha256,
      isActive: true,
    },
    create: {
      version: 1,
      title: "JANUS Mutual Non-Disclosure Agreement v1",
      body: NDA_BODY,
      contentSha256,
      isActive: true,
    },
  });

  await prisma.$executeRawUnsafe(`
    UPDATE nda_templates SET is_active = FALSE WHERE version <> 1
  `);

  console.log("Seeding 22 realistic student innovation project showcases...");

  for (let i = 0; i < SAMPLE_PROJECTS.length; i++) {
    const item = SAMPLE_PROJECTS[i];
    const sub = `local:student:${item.handle}`;

    // Upsert student user
    const user = await prisma.user.upsert({
      where: { handle: item.handle },
      update: {
        displayName: item.name,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        profileComplete: true,
        email: item.email,
        cognitoSub: sub,
      },
      create: {
        cognitoSub: sub,
        email: item.email,
        handle: item.handle,
        displayName: item.name,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        profileComplete: true,
      },
    });

    // Upsert student profile
    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {
        university: item.university,
        universityNormalized: item.university.trim().toLowerCase(),
        headline: item.headline,
        city: item.city,
        graduationYear: 2026,
        bio: `${item.headline} at ${item.university}. Passionate about real-world engineering impact.`,
      },
      create: {
        userId: user.id,
        university: item.university,
        universityNormalized: item.university.trim().toLowerCase(),
        headline: item.headline,
        city: item.city,
        graduationYear: 2026,
        bio: `${item.headline} at ${item.university}. Passionate about real-world engineering impact.`,
      },
    });

    // Create or find video showcase
    const existingVideo = await prisma.video.findFirst({
      where: { authorId: user.id },
    });

    let videoId = existingVideo?.id;

    const VERIFIED_VIDEOS = [
      "https://vjs.zencdn.net/v/oceans.mp4",
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      "https://media.w3.org/2010/05/sintel/trailer.mp4",
      "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
      "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
      "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
      "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4",
    ];
    const streamUrl = VERIFIED_VIDEOS[i % VERIFIED_VIDEOS.length];

    if (!existingVideo) {
      const video = await prisma.video.create({
        data: {
          authorId: user.id,
          caption: item.caption,
          durationMs: 35000,
          status: VideoStatus.READY,
          visibility: VideoVisibility.PUBLIC_FEED,
          moderationStatus: ModerationStatus.CLEAR,
          hlsMasterKey: streamUrl,
          posterKey: item.posterUrl,
          hasVault: item.hasVault,
          likeCount: item.likes,
          // Counter must match real comment rows; the seed creates none.
          commentCount: 0,
          bookmarkCount: item.saves,
          publishedAt: new Date(Date.now() - i * 3600 * 1000 * 4),
          createdAt: new Date(Date.now() - i * 3600 * 1000 * 4),
        },
      });
      videoId = video.id;
    } else {
      await prisma.video.update({
        where: { id: existingVideo.id },
        data: {
          caption: item.caption,
          hlsMasterKey: streamUrl,
          posterKey: item.posterUrl,
          hasVault: item.hasVault,
          likeCount: item.likes,
          commentCount: await prisma.comment.count({ where: { videoId: existingVideo.id, deletedAt: null } }),
          bookmarkCount: item.saves,
          status: VideoStatus.READY,
          visibility: VideoVisibility.PUBLIC_FEED,
          moderationStatus: ModerationStatus.CLEAR,
        },
      });
    }

    // Attach sample protected vault asset if hasVault
    if (item.hasVault && videoId && item.vaultFileName) {
      const existingAsset = await prisma.vaultAsset.findFirst({
        where: { ownerId: user.id },
      });

      if (!existingAsset) {
        const asset = await prisma.vaultAsset.create({
          data: {
            ownerId: user.id,
            kind: item.vaultFileName.endsWith(".zip") ? VaultAssetKind.CODE_ARCHIVE : VaultAssetKind.SCHEMATIC,
            originalName: item.vaultFileName,
            contentType: item.vaultFileType ?? "application/pdf",
            byteSize: 14200000,
            s3Key: `vault/${user.id}/${item.vaultFileName}`,
            kmsKeyArn: "arn:aws:kms:ap-south-1:000000000000:key/sample-vault-key",
            checksumSha256: createHash("sha256").update(item.vaultFileName).digest("hex"),
          },
        });

        await prisma.videoVaultLink.upsert({
          where: { videoId_vaultAssetId: { videoId, vaultAssetId: asset.id } },
          update: {},
          create: { videoId, vaultAssetId: asset.id },
        });
      }
    }

    console.log(`✓ Seeded ${item.name} (@${item.handle}) - ${item.headline}`);
  }

  console.log("\nSuccessfully seeded 22 student innovation projects into the database!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
