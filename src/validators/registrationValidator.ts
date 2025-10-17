import { z } from "zod";


export const participantSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap wajib diisi"),
  nik: z.string().regex(/^\d+$/, "NIK hanya boleh berisi angka"),
  nisn: z.string().regex(/^\d+$/, "NISN hanya boleh berisi angka"),
  address: z.string(),
  birthPlace: z.string(),
  birthDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Tanggal lahir tidak valid"),
  schoolName: z.string(),
  gradYear: z.number().min(2000).max(new Date().getFullYear()),
  npsn: z.string().regex(/^\d+$/, "NPSN hanya boleh berisi angka"),
  childOrder: z.string(),
  parentCondition: z.string(),
  socialAid: z.string(),
  familyStatus: z.string(),
  livingWith: z.string(),
  phone: z.string(),
  socialMedia: z.string().optional(),
});


export const achievementSchema = z.object({
  math3: z.number().optional(),
  math4: z.number().optional(),
  math5: z.number().optional(),
  indo3: z.number().optional(),
  indo4: z.number().optional(),
  indo5: z.number().optional(),
  english3: z.number().optional(),
  english4: z.number().optional(),
  english5: z.number().optional(),
  ipa3: z.number().optional(),
  ipa4: z.number().optional(),
  ipa5: z.number().optional(),
  ips3: z.number().optional(),
  ips4: z.number().optional(),
  ips5: z.number().optional(),
  pai3: z.number().optional(),
  pai4: z.number().optional(),
  pai5: z.number().optional(),
  foreignLang: z.string().optional(),
  hafalan: z.string().optional(),
  achievements: z.string().optional(),
  organizations: z.string().optional(),
  dream: z.string().optional(),
  hobby: z.string().optional(),
  uniqueness: z.string().optional(),
});


export const parentSchema = z.object({
  fatherName: z.string(),
  fatherEdu: z.string().optional(),
  fatherPhone: z.string().optional(),
  fatherJob: z.string().optional(),
  fatherAddress: z.string().optional(),
  fatherWorkAddress: z.string().optional(),
  fatherDependents: z.number().optional(),
  fatherHope: z.string().optional(),

  motherName: z.string(),
  motherEdu: z.string().optional(),
  motherPhone: z.string().optional(),
  motherJob: z.string().optional(),
  motherAddress: z.string().optional(),
  motherWorkAddress: z.string().optional(),
  motherDependents: z.number().optional(),
  motherHope: z.string().optional(),

  guardianName: z.string().optional(),
  guardianRelation: z.string().optional(),
  guardianJob: z.string().optional(),
  guardianEmail: z.string().optional(),
  guardianDependents: z.number().optional(),
  guardianAddress: z.string().optional(),
  incomeSource: z.string().optional(),
  relativeName: z.string().optional(),
  relativePhone: z.string().optional(),
  relativeRelation: z.string().optional(),
  sourceInfo: z.string().optional(),
  hasScholarSibling: z.boolean().optional(),
  relativeEmail: z.string().optional(),
});


export const housingSchema = z.object({
  yearAcquired: z.number().optional(),
  landArea: z.number().optional(),
  ownershipStatus: z.string().optional(),
  houseCondition: z.string().optional(),
  vehicle: z.string().optional(),
  property: z.string().optional(),
  vehicleOwnership: z.string().optional(),
  propertyOwnership: z.string().optional(),
  electricity: z.string().optional(),
  waterSource: z.string().optional(),
});


export const healthSchema = z.object({
  height: z.number().optional(),
  weight: z.number().optional(),
  infectiousDiseases: z.string().optional(),
  allergies: z.string().optional(),
  underTreatment: z.boolean().optional(),
  bloodType: z.string().optional(),
  colorBlind: z.boolean().optional(),
  smoker: z.boolean().optional(),
});


export const consentSchema = z.object({
  statement1: z.boolean(),
  statement2: z.boolean(),
  statement3: z.boolean(),
});


export const registrationSchema = z.object({
  participant: participantSchema,
  achievements: achievementSchema.optional(),
  parents: parentSchema.optional(),
  housing: housingSchema.optional(),
  health: healthSchema.optional(),
  consent: consentSchema.optional(),
});
