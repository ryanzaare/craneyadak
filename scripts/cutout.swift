// scripts/cutout.swift — حذف پس‌زمینه‌ی عکس خام قطعه، روی خود مک، بدون هوش مصنوعی مولد.
// ---------------------------------------------------------------------------
// استفاده: swift scripts/cutout.swift <ورودی.jpg|png|heic> <خروجی.png>
//
// چرا این و نه Gemini: Gemini تصویر را *از نو می‌سازد* — هر پیکسل، از جمله برچسب و کد روی قطعه، بازنقاشی می‌شود
// (درس مستر اول: برچسب‌های ریموت ناخوانا شدند). Vision اپل فقط یک *ماسک* می‌سازد؛ پیکسل‌های قطعه همان پیکسل‌های
// عکس اصلی‌اند و فقط پس‌زمینه شفاف می‌شود. نتیجه: PNG شفاف برای هر ابزار طراحی (`npm run cutout -- raw.jpg cut.png`).
// ابزار مستقل است: compositor برنامه‌ای (۲۸ مهر ۱۴۰۵) به تصمیم کارفرما حذف شد؛ این فقط حذف پس‌زمینه است.
// نیازمند macOS 14 یا بالاتر (VNGenerateForegroundInstanceMaskRequest).
// ---------------------------------------------------------------------------
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

func fail(_ msg: String) -> Never {
  FileHandle.standardError.write("❌ \(msg)\n".data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count == 3 else { fail("استفاده: swift scripts/cutout.swift <ورودی> <خروجی.png>") }
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
guard outURL.pathExtension.lowercased() == "png" else { fail("خروجی باید .png باشد (شفافیت)") }
guard let input = CIImage(contentsOf: inURL, options: [.applyOrientationProperty: true]) else { fail("خواندن \(inURL.path) ممکن نشد") }

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: input)
do { try handler.perform([request]) } catch { fail("Vision: \(error.localizedDescription)") }
guard let result = request.results?.first, !result.allInstances.isEmpty else {
  fail("هیچ شیئی در پیش‌زمینه پیدا نشد — عکس را با پس‌زمینه‌ی ساده‌تر بگیرید")
}
let maskBuffer: CVPixelBuffer
do {
  // همه‌ی نمونه‌ها (قطعه + کابلش) با هم؛ croppedToInstancesExtent=false تا ابعاد با عکس اصلی یکی بماند.
  maskBuffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
} catch { fail("ساخت ماسک: \(error.localizedDescription)") }

let mask = CIImage(cvPixelBuffer: maskBuffer)
let clear = CIImage(color: .clear).cropped(to: input.extent)
guard let blend = CIFilter(name: "CIBlendWithMask", parameters: [
  kCIInputImageKey: input, kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: mask,
])?.outputImage else { fail("ترکیب ماسک ممکن نشد") }

let ctx = CIContext()
guard let cg = ctx.createCGImage(blend, from: input.extent, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!) else { fail("رندر خروجی ممکن نشد") }
guard let dest = CGImageDestinationCreateWithURL(outURL as CFURL, UTType.png.identifier as CFString, 1, nil) else { fail("نوشتن \(outURL.path) ممکن نشد") }
CGImageDestinationAddImage(dest, cg, nil)
guard CGImageDestinationFinalize(dest) else { fail("ذخیره‌ی PNG ناموفق") }
print("✅ \(outURL.path) — \(cg.width)×\(cg.height)، \(result.allInstances.count) شیء پیش‌زمینه")
