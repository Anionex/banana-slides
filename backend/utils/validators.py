"""
Data validation utilities
"""
from typing import Set

# Project status states
PROJECT_STATUSES = {
    'DRAFT', 
    'OUTLINE_GENERATED', 
    'DESCRIPTIONS_GENERATED', 
    'GENERATING_IMAGES', 
    'COMPLETED'
}

# Page status states
PAGE_STATUSES = {
    'DRAFT', 
    'DESCRIPTION_GENERATED', 
    'GENERATING', 
    'COMPLETED', 
    'FAILED'
}

# Task status states
TASK_STATUSES = {
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
}

# Task types
TASK_TYPES = {
    'GENERATE_DESCRIPTIONS',
    'GENERATE_IMAGES',
    'EXPORT_EDITABLE_PPTX'
}


def validate_project_status(status: str) -> bool:
    """Validate project status"""
    return status in PROJECT_STATUSES


def validate_page_status(status: str) -> bool:
    """Validate page status"""
    return status in PAGE_STATUSES


def validate_task_status(status: str) -> bool:
    """Validate task status"""
    return status in TASK_STATUSES


def validate_task_type(task_type: str) -> bool:
    """Validate task type"""
    return task_type in TASK_TYPES


def allowed_file(filename: str, allowed_extensions: Set[str]) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions


# Common disposable / temporary email domains
DISPOSABLE_EMAIL_DOMAINS = {
    # Major disposable email services
    'mailinator.com', 'guerrillamail.com', 'guerrillamail.net',
    'guerrillamail.org', 'guerrillamail.de', 'grr.la',
    'tempmail.com', 'temp-mail.org', 'temp-mail.io',
    'throwaway.email', 'throwaway.com',
    'yopmail.com', 'yopmail.fr', 'yopmail.net',
    'sharklasers.com', 'guerrillamailblock.com', 'spam4.me',
    'trashmail.com', 'trashmail.me', 'trashmail.net',
    'trashmail.org', 'trashmail.io',
    'dispostable.com', 'maildrop.cc',
    'fakeinbox.com', 'fakemail.net',
    'tempinbox.com', 'tempail.com',
    'mailnesia.com', 'mailcatch.com',
    'mintemail.com', 'discard.email',
    'harakirimail.com', 'mailnull.com',
    'jetable.org', 'trash-mail.com',
    'mytemp.email', 'mohmal.com',
    'burnermail.io', 'tempmailo.com',
    'emailondeck.com', 'inboxkitten.com',
    # 10minutemail variants
    '10minutemail.com', '10minutemail.net',
    '10minutemail.org', '10minutemail.co.za',
    '10minmail.com',
    # Guerrilla variants
    'guerrillamail.biz', 'guerrillamail.info',
    # Other popular ones
    'mailtemp.net', 'tempmailaddress.com',
    'crazymailing.com', 'disposableemailaddresses.emailmiser.com',
    'getnada.com', 'nada.email',
    'emailfake.com', 'generator.email',
    'armyspy.com', 'cuvox.de', 'dayrep.com',
    'einrot.com', 'fleckens.hu', 'gustr.com',
    'jourrapide.com', 'rhyta.com', 'superrito.com',
    'teleworm.us',
    'spamgourmet.com', 'mytrashmail.com',
    'mailexpire.com', 'throwam.com',
    'tmail.ws', 'tmpmail.net', 'tmpmail.org',
    'binkmail.com', 'bobmail.info',
    'chammy.info', 'devnullmail.com',
    'disposeamail.com', 'dodgit.com',
    'e4ward.com', 'emailigo.de',
    'emailsensei.com', 'emailtemporario.com.br',
    'ephemail.net', 'filzmail.com',
    'getairmail.com', 'getonemail.com',
    'guerrillamail.com', 'haltospam.com',
    'instantemailaddress.com', 'jetable.net',
    'kasmail.com', 'koszmail.pl',
    'kurzepost.de', 'letthemeatspam.com',
    'lhsdv.com', 'lookugly.com',
    'mailblocks.com', 'mailforspam.com',
    'mailin8r.com', 'mailinator.net',
    'mailinator2.com', 'mailmoat.com',
    'mailshell.com', 'mailslurp.com',
    'mailzilla.com', 'nomail.xl.cx',
    'nospamfor.us', 'nowmymail.com',
    'objectmail.com', 'obobbo.com',
    'onewaymail.com', 'owlpic.com',
    'proxymail.eu', 'punkass.com',
    'receiveee.com', 'safetypost.de',
    'schrott-email.de', 'shieldemail.com',
    'sogetthis.com', 'soodonims.com',
    'spam.la', 'spamavert.com',
    'spamcero.com', 'spamex.com',
    'spamfree24.org', 'spamhole.com',
    'spaml.com', 'spammotel.com',
    'spamspot.com', 'spamthis.co.uk',
    'speed.1s.fr', 'suremail.info',
    'tempemail.co.za', 'tempemail.net',
    'tempinbox.co.uk', 'tempmailer.com',
    'tempomail.fr', 'temporaryemail.net',
    'temporaryforwarding.com', 'temporaryinbox.com',
    'temporarymailaddress.com', 'thankyou2010.com',
    'thisisnotmyrealemail.com', 'trash2009.com',
    'turual.com', 'tyldd.com',
    'uggsrock.com', 'wegwerfmail.de',
    'wegwerfmail.net', 'wh4f.org',
    'whyspam.me', 'wuzup.net',
    'yapped.net', 'yep.it',
    'yogamaven.com', 'zehnminutenmail.de',
}


def is_disposable_email(email: str) -> bool:
    """Check if the email uses a known disposable/temporary email domain."""
    domain = email.rsplit('@', 1)[-1].lower().strip()
    return domain in DISPOSABLE_EMAIL_DOMAINS

