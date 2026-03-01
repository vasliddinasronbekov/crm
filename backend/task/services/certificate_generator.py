"""
Certificate Generation Service
Generates beautiful PDF certificates with QR codes for verification
"""

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage
import qrcode
import io
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone


class CertificateGenerator:
    """Generate professional certificates based on a template"""

    def __init__(self, certificate):
        self.certificate = certificate
        self.template = certificate.template
        self.width, self.height = landscape(A4)

    def generate_qr_code(self):
        """Generate QR code for certificate verification"""
        verification_base_url = getattr(settings, "FRONTEND_URL", None) or settings.SITE_URL
        verification_url = f"{verification_base_url.rstrip('/')}/verify/{self.certificate.certificate_id}"
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=2)
        qr.add_data(verification_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        img_buffer = io.BytesIO()
        qr_img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        return img_buffer, verification_url

    def draw_background(self, c):
        """Draw template background image or a default border"""
        if self.template and self.template.background_image:
            try:
                PILImage.open(self.template.background_image.path)
                c.drawImage(self.template.background_image.path, 0, 0, width=self.width, height=self.height, preserveAspectRatio=False)
            except Exception as e:
                print(f"Error drawing background image: {e}")
                self.draw_default_border(c)
        else:
            if self.template and self.template.background_color:
                c.setFillColor(HexColor(self.template.background_color))
                c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
            self.draw_default_border(c)

    def draw_default_border(self, c):
        """Draw a default decorative border if no background is provided"""
        border_color = '#DAA520'
        if self.template and self.template.border_color:
            border_color = self.template.border_color
        c.setStrokeColor(HexColor(border_color))
        c.setLineWidth(3)
        c.rect(0.5*inch, 0.5*inch, self.width - 1*inch, self.height - 1*inch, stroke=1, fill=0)

    def draw_dynamic_fields(self, c):
        """Draw dynamic fields based on template layout_config"""
        if not self.template or not self.template.layout_config:
            # Fallback to a default layout if no config exists
            self.draw_default_layout(c)
            return

        context = self.get_context_data()

        for field_name, config in self.template.layout_config.items():
            if field_name != 'qr_code':
                text = config.get('text')
                if field_name in context:
                    text = str(context[field_name])
                if text is None:
                    continue
                x = config.get('x', 50)
                y = config.get('y', 50)
                font_name = config.get('font_name', 'Helvetica')
                font_size = config.get('font_size', 12)
                color = config.get('color', self.template.text_color if self.template else '#000000')
                align = config.get('align', 'left')

                c.setFont(font_name, font_size)
                c.setFillColor(HexColor(color))
                if align == 'center':
                    c.drawCentredString(x, y, str(text))
                elif align == 'right':
                    c.drawRightString(x, y, str(text))
                else:
                    c.drawString(x, y, str(text))

    def get_context_data(self):
        """Prepare data to be rendered on the certificate"""
        teacher_name = ''
        if self.certificate.course and self.certificate.course.instructor:
            teacher_name = self.certificate.course.instructor.get_full_name()

        return {
            'student_name': self.certificate.student_name,
            'course_name': self.certificate.course_name,
            'teacher_name': teacher_name,
            'completion_date': self.certificate.completion_date.strftime("%B %d, %Y"),
            'issued_date': self.certificate.issued_date.strftime("%B %d, %Y"),
            'grade': self.certificate.grade,
            'hours': self.certificate.hours_completed,
            'verification_code': self.certificate.verification_code,
            'certificate_id': str(self.certificate.certificate_id),
            'organization_name': getattr(settings, 'CERTIFICATE_ORGANIZATION_NAME', 'Edu Platform'),
        }

    def draw_default_layout(self, c):
        """A hardcoded default layout for when templates are not configured"""
        text_color = self.template.text_color if self.template and self.template.text_color else '#111827'
        c.setFillColor(HexColor(text_color))
        c.setFont("Helvetica-Bold", 36)
        c.drawCentredString(self.width / 2, self.height - 1.5*inch, "CERTIFICATE OF COMPLETION")
        c.setFont("Helvetica", 14)
        c.drawCentredString(self.width / 2, self.height - 2.2*inch, "This certifies that")
        c.setFont("Helvetica-Bold", 42)
        c.drawCentredString(self.width / 2, self.height - 3.2*inch, self.certificate.student_name)
        c.setFont("Helvetica", 14)
        c.drawCentredString(self.width / 2, self.height - 4.0*inch, "has successfully completed the course")
        c.setFont("Helvetica-Bold", 24)
        c.drawCentredString(self.width / 2, self.height - 4.6*inch, self.certificate.course_name)
        c.setFont("Helvetica", 12)
        c.drawCentredString(self.width / 2, self.height - 5.2*inch, f"Issued on {self.certificate.issued_date.strftime('%B %d, %Y')}")

        footer_y = 0.9 * inch
        c.setFont("Helvetica", 10)
        c.drawString(0.9 * inch, footer_y + 24, f"Completion Date: {self.certificate.completion_date.strftime('%B %d, %Y')}")
        if self.certificate.grade:
            c.drawString(0.9 * inch, footer_y + 12, f"Grade: {self.certificate.grade}")
        if self.certificate.hours_completed:
            c.drawString(0.9 * inch, footer_y, f"Hours Completed: {self.certificate.hours_completed}")
        c.drawRightString(self.width - 0.9 * inch, footer_y, f"Verification: {self.certificate.verification_code}")

    def generate(self):
        """Generate the complete certificate"""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=landscape(A4))

        # Draw background/border
        self.draw_background(c)

        # Draw dynamic content
        self.draw_dynamic_fields(c)

        # Generate and draw QR code
        qr_buffer, verification_url = self.generate_qr_code()
        self.certificate.verification_url = verification_url
        
        # Draw QR code based on layout config if available
        qr_config = self.template.layout_config.get('qr_code', {}) if self.template else {}
        qr_x = qr_config.get('x', self.width - 2*inch)
        qr_y = qr_config.get('y', 0.7*inch)
        qr_size = qr_config.get('size', 1.2*inch)

        c.drawImage(ImageReader(qr_buffer), qr_x, qr_y, width=qr_size, height=qr_size, preserveAspectRatio=True)

        c.showPage()
        c.save()

        buffer.seek(0)
        pdf_content = buffer.getvalue()
        filename = f"certificate_{self.certificate.certificate_id}.pdf"
        self.certificate.certificate_file.save(filename, ContentFile(pdf_content), save=False)

        return pdf_content


def _resolve_template(template_id=None):
    from ..certificate_models import CertificateTemplate

    template = None
    if template_id:
        try:
            template = CertificateTemplate.objects.get(id=template_id, is_active=True)
        except CertificateTemplate.DoesNotExist:
            template = None

    if template is None:
        template = (
            CertificateTemplate.objects.filter(is_default=True, is_active=True).first()
            or CertificateTemplate.objects.filter(is_active=True).first()
        )

    return template


@transaction.atomic
def issue_certificate_for_student(
    student,
    course,
    issued_by=None,
    template_id=None,
    grade='',
    hours=0,
    completion_date=None,
    notes='',
    force_regenerate=False,
):
    """
    Create or update a certificate and regenerate the PDF when data changes.

    Args:
        student: User instance
        course: Course instance
        issued_by: User issuing or reissuing the certificate
        template_id: ID of the CertificateTemplate to use
        grade: Optional grade (A, B, C or percentage)
        hours: Hours completed
        completion_date: Course completion date
        notes: Admin notes
        force_regenerate: Force PDF regeneration even if data is unchanged

    Returns:
        tuple[Certificate, bool]: certificate instance and created flag
    """
    from ..certificate_models import Certificate

    resolved_template = _resolve_template(template_id)
    resolved_completion_date = completion_date or timezone.now().date()

    certificate, created = Certificate.objects.get_or_create(
        student=student,
        course=course,
        defaults={
            'template': resolved_template,
            'completion_date': resolved_completion_date,
            'grade': grade,
            'hours_completed': hours,
            'notes': notes,
            'issued_by': issued_by,
        }
    )

    tracked_fields = {
        'template': resolved_template,
        'completion_date': resolved_completion_date,
        'grade': grade,
        'hours_completed': hours,
        'notes': notes,
    }
    changed = created

    for field_name, new_value in tracked_fields.items():
        if getattr(certificate, field_name) != new_value:
            setattr(certificate, field_name, new_value)
            changed = True

    if issued_by and certificate.issued_by_id != issued_by.id:
        certificate.issued_by = issued_by
        changed = True

    should_regenerate = force_regenerate or changed or not certificate.certificate_file

    if should_regenerate:
        if certificate.certificate_file:
            certificate.certificate_file.delete(save=False)
        certificate.issued_date = timezone.now()
        generator = CertificateGenerator(certificate)
        generator.generate()
        certificate.save(update_fields=[
            'template', 'completion_date', 'grade', 'hours_completed',
            'certificate_file', 'verification_url', 'issued_by',
            'issued_date', 'notes', 'updated_at',
        ])
    elif changed:
        certificate.save(update_fields=[
            'template', 'completion_date', 'grade', 'hours_completed',
            'issued_by', 'notes', 'updated_at',
        ])

    return certificate, created


def generate_certificate_for_student(student, course, template_id=None, grade='', hours=0):
    certificate, _ = issue_certificate_for_student(
        student=student,
        course=course,
        template_id=template_id,
        grade=grade,
        hours=hours,
    )
    return certificate
