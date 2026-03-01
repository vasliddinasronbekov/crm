"""
White-Label Solution Models

Enterprise-tier feature for custom branding and multi-tenancy
"""

from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from users.models import User
from .models import UserSubscription


class TenantOrganization(models.Model):
    """
    White-label tenant organization
    Each enterprise customer gets their own branded instance
    """
    STATUS_CHOICES = [
        ('trial', 'Trial'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('canceled', 'Canceled'),
    ]

    # Organization Info
    name = models.CharField(max_length=200, help_text="Organization name")
    slug = models.SlugField(unique=True, help_text="URL-safe identifier")
    legal_name = models.CharField(max_length=300, blank=True)

    # Subscription
    subscription = models.OneToOneField(
        UserSubscription,
        on_delete=models.PROTECT,
        related_name='tenant_org'
    )

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')

    # Branding
    display_name = models.CharField(max_length=200, help_text="Public-facing name")
    logo_url = models.URLField(blank=True)
    favicon_url = models.URLField(blank=True)
    primary_color = models.CharField(max_length=7, default='#4F46E5', help_text="Hex color code")
    secondary_color = models.CharField(max_length=7, default='#10B981', help_text="Hex color code")

    # Custom Domain
    custom_domain = models.CharField(max_length=255, blank=True, unique=True, null=True)
    domain_verified = models.BooleanField(default=False)
    ssl_enabled = models.BooleanField(default=False)

    # Contact
    admin_email = models.EmailField()
    support_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)

    # Address
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)

    # Limits (from subscription plan)
    max_users = models.IntegerField(default=100, validators=[MinValueValidator(1)])
    max_courses = models.IntegerField(default=50, validators=[MinValueValidator(1)])
    max_storage_gb = models.IntegerField(default=100, validators=[MinValueValidator(1)])

    # Current Usage
    active_users_count = models.IntegerField(default=0)
    courses_count = models.IntegerField(default=0)
    storage_used_gb = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Features
    features_enabled = models.JSONField(
        default=dict,
        help_text="Custom features configuration"
    )
    # Example: {"sso": true, "api_access": true, "custom_reports": true}

    # Settings
    settings = models.JSONField(
        default=dict,
        help_text="Tenant-specific settings"
    )

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    trial_end_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['custom_domain']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f"{self.name} ({self.slug})"

    @property
    def is_over_user_limit(self):
        """Check if organization exceeded user limit"""
        return self.active_users_count >= self.max_users

    @property
    def is_over_course_limit(self):
        """Check if organization exceeded course limit"""
        return self.courses_count >= self.max_courses

    @property
    def is_over_storage_limit(self):
        """Check if organization exceeded storage limit"""
        return self.storage_used_gb >= self.max_storage_gb


class TenantUser(models.Model):
    """
    Map users to tenant organizations
    Users can belong to multiple organizations with different roles
    """
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('instructor', 'Instructor'),
        ('student', 'Student'),
    ]

    tenant = models.ForeignKey(
        TenantOrganization,
        on_delete=models.CASCADE,
        related_name='tenant_users'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='tenant_memberships'
    )

    # Role & Permissions
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    custom_permissions = models.JSONField(default=list, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    invited_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['tenant', 'user']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'role']),
            models.Index(fields=['user', 'is_active']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} @ {self.tenant.name} ({self.role})"


class SSOConfiguration(models.Model):
    """
    Single Sign-On configuration for enterprise tenants
    """
    PROVIDER_CHOICES = [
        ('saml', 'SAML 2.0'),
        ('oauth2', 'OAuth 2.0'),
        ('oidc', 'OpenID Connect'),
        ('ldap', 'LDAP/Active Directory'),
        ('azure_ad', 'Azure Active Directory'),
        ('google_workspace', 'Google Workspace'),
        ('okta', 'Okta'),
    ]

    tenant = models.OneToOneField(
        TenantOrganization,
        on_delete=models.CASCADE,
        related_name='sso_config'
    )

    # Provider
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES)
    is_enabled = models.BooleanField(default=False)

    # SAML Configuration
    saml_entity_id = models.CharField(max_length=500, blank=True)
    saml_sso_url = models.URLField(blank=True, help_text="Identity Provider SSO URL")
    saml_slo_url = models.URLField(blank=True, help_text="Single Logout URL")
    saml_x509_cert = models.TextField(blank=True, help_text="X.509 Certificate")

    # OAuth/OIDC Configuration
    oauth_client_id = models.CharField(max_length=255, blank=True)
    oauth_client_secret = models.CharField(max_length=255, blank=True)
    oauth_authorize_url = models.URLField(blank=True)
    oauth_token_url = models.URLField(blank=True)
    oauth_userinfo_url = models.URLField(blank=True)
    oauth_scopes = models.CharField(max_length=500, blank=True, default='openid profile email')

    # LDAP Configuration
    ldap_server_url = models.CharField(max_length=500, blank=True)
    ldap_bind_dn = models.CharField(max_length=500, blank=True)
    ldap_bind_password = models.CharField(max_length=255, blank=True)
    ldap_user_search_base = models.CharField(max_length=500, blank=True)
    ldap_user_search_filter = models.CharField(max_length=500, blank=True, default='(uid={username})')

    # Attribute Mapping
    attribute_mapping = models.JSONField(
        default=dict,
        help_text="Map SSO attributes to user fields"
    )
    # Example: {"email": "email", "first_name": "given_name", "last_name": "family_name"}

    # Settings
    force_sso = models.BooleanField(default=False, help_text="Require SSO for all tenant users")
    auto_provision_users = models.BooleanField(default=True, help_text="Auto-create users on first login")
    default_role = models.CharField(max_length=20, default='student')

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'SSO Configuration'
        verbose_name_plural = 'SSO Configurations'

    def __str__(self):
        return f"SSO for {self.tenant.name} ({self.provider})"


class APIKey(models.Model):
    """
    API keys for enterprise tenant integrations
    """
    tenant = models.ForeignKey(
        TenantOrganization,
        on_delete=models.CASCADE,
        related_name='api_keys'
    )

    # Key Info
    name = models.CharField(max_length=200, help_text="Human-readable name")
    key = models.CharField(max_length=64, unique=True, db_index=True)
    key_prefix = models.CharField(max_length=8, help_text="First 8 chars for display")

    # Permissions & Scopes
    scopes = models.JSONField(
        default=list,
        help_text="API scopes/permissions"
    )
    # Example: ["courses:read", "courses:write", "users:read"]

    # Rate Limiting
    rate_limit_per_hour = models.IntegerField(default=1000)

    # Status
    is_active = models.BooleanField(default=True)

    # Usage Tracking
    last_used_at = models.DateTimeField(null=True, blank=True)
    total_requests = models.IntegerField(default=0)

    # Expiration
    expires_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_api_keys'
    )
    metadata = models.JSONField(default=dict, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['key']),
        ]

    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"

    @property
    def is_expired(self):
        """Check if API key is expired"""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False

    @staticmethod
    def generate_key():
        """Generate random API key"""
        import secrets
        return secrets.token_urlsafe(48)

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = self.generate_key()
            self.key_prefix = self.key[:8]
        super().save(*args, **kwargs)


class CustomBranding(models.Model):
    """
    Advanced branding customization for tenant
    """
    tenant = models.OneToOneField(
        TenantOrganization,
        on_delete=models.CASCADE,
        related_name='branding'
    )

    # Colors
    color_scheme = models.JSONField(
        default=dict,
        help_text="Complete color scheme"
    )
    # Example: {
    #   "primary": "#4F46E5",
    #   "secondary": "#10B981",
    #   "accent": "#F59E0B",
    #   "background": "#FFFFFF",
    #   "text": "#1F2937"
    # }

    # Typography
    font_family = models.CharField(max_length=200, default='Inter, sans-serif')
    heading_font = models.CharField(max_length=200, blank=True)

    # Images
    logo_light = models.URLField(blank=True, help_text="Logo for light backgrounds")
    logo_dark = models.URLField(blank=True, help_text="Logo for dark backgrounds")
    logo_square = models.URLField(blank=True, help_text="Square logo for icons")
    favicon = models.URLField(blank=True)
    og_image = models.URLField(blank=True, help_text="Open Graph image for social sharing")

    # Custom CSS
    custom_css = models.TextField(blank=True, help_text="Custom CSS for advanced styling")

    # Email Templates
    email_header_image = models.URLField(blank=True)
    email_footer_text = models.TextField(blank=True)

    # Misc
    hide_platform_branding = models.BooleanField(
        default=False,
        help_text="Hide 'Powered by [Platform]' footer"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Custom Branding'
        verbose_name_plural = 'Custom Branding'

    def __str__(self):
        return f"Branding for {self.tenant.name}"


class TenantInvoice(models.Model):
    """
    Enterprise billing and invoicing
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('void', 'Void'),
    ]

    tenant = models.ForeignKey(
        TenantOrganization,
        on_delete=models.CASCADE,
        related_name='invoices'
    )

    # Invoice Details
    invoice_number = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    # Amounts
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')

    # Line Items
    line_items = models.JSONField(default=list)

    # Payment Terms
    payment_terms = models.CharField(max_length=100, default='Net 30')

    # Dates
    issue_date = models.DateField()
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)

    # Notes
    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)

    # Files
    pdf_url = models.URLField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date']
        indexes = [
            models.Index(fields=['tenant', '-issue_date']),
            models.Index(fields=['status', 'due_date']),
        ]

    def __str__(self):
        return f"Invoice {self.invoice_number} for {self.tenant.name}"

    @property
    def is_overdue(self):
        """Check if invoice is overdue"""
        if self.status != 'paid' and self.due_date:
            return timezone.now().date() > self.due_date
        return False
