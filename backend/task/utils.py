from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from django.core.files.base import ContentFile
import qrcode
from PIL import Image

def generate_certificate_pdf(issued_certificate):
    template = issued_certificate.template
    student_info = issued_certificate.student_info

    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Draw background image
    if template.background_image:
        p.drawImage(ImageReader(template.background_image.path), 0, 0, width=width, height=height)

    # Draw placeholders
    for placeholder in template.placeholders:
        text = student_info.get(placeholder['id'], '')
        p.drawString(placeholder['x'], height - placeholder['y'], text)

    # Generate and draw QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    # TODO: Replace with actual verification URL
    verification_url = f"https://example.com/verify/{issued_certificate.unique_id}"
    qr.add_data(verification_url)
    qr.make(fit=True)

    img = qr.make_image(fill='black', back_color='white')
    img_buffer = BytesIO()
    img.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    p.drawImage(ImageReader(img_buffer), x=50, y=50, width=100, height=100)


    p.showPage()
    p.save()

    pdf = buffer.getvalue()
    buffer.close()

    file_name = f"certificate_{issued_certificate.unique_id}.pdf"
    issued_certificate.generated_pdf.save(file_name, ContentFile(pdf))
    issued_certificate.save()
