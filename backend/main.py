import os
from datetime import datetime, timedelta
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
import uuid
import hashlib
import aiosmtpd.controller
import asyncio
from email.parser import BytesParser
from email.policy import default
import requests

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "/app/data/db.sqlite")
MAIL_STORAGE_PATH = os.getenv("MAIL_STORAGE_PATH", "/app/mailstore")
API_KEY = os.getenv("API_KEY", "changeme")
MAIL_EXPIRY_HOURS = int(os.getenv("MAIL_EXPIRY_HOURS", "24"))
DOMAIN = os.getenv("DOMAIN", "mail.local")
SERVER_IP = os.getenv("SERVER_IP", "127.0.0.1")

# Cloudflare config
CF_API_TOKEN = os.getenv("CF_API_TOKEN", "")
CF_API_EMAIL = os.getenv("CF_API_EMAIL", "")

# DMARC report email
DMARC_REPORT_EMAIL = os.getenv("DMARC_REPORT_EMAIL", "dmarc-reports")

# Helper function to get zone_id by domain name
def get_zone_id(domain_name: str):
    if not CF_API_TOKEN:
        return None
    
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Query Cloudflare API to find the zone
    response = requests.get(
        f"https://api.cloudflare.com/client/v4/zones?name={domain_name}",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("success") and data.get("result"):
            return data["result"][0]["id"]
    
    return None

# Auto-configure DNS records for a domain
def auto_configure_dns(domain: str):
    if not CF_API_TOKEN or not CF_API_EMAIL:
        return {"configured": False, "message": "Cloudflare not configured"}
    
    # Get zone_id for the domain
    zone_id = get_zone_id(domain)
    if not zone_id:
        return {"configured": False, "message": f"Domain {domain} not found in Cloudflare"}
    
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    records_created = []
    
    # 1. A Record for mail.domain
    a_record = {
        "type": "A",
        "name": f"mail.{domain}",
        "content": SERVER_IP,
        "proxied": False
    }
    
    # 2. MX Record
    mx_record = {
        "type": "MX",
        "name": domain,
        "content": f"mail.{domain}",
        "priority": 10,
        "proxied": False
    }
    
    # 3. SPF TXT Record
    spf_record = {
        "type": "TXT",
        "name": domain,
        "content": f"v=spf1 mx a:{SERVER_IP} ~all",
        "proxied": False
    }
    
    # 4. DMARC TXT Record
    dmarc_record = {
        "type": "TXT",
        "name": f"_dmarc.{domain}",
        "content": f"v=DMARC1; p=quarantine; rua=mailto:{DMARC_REPORT_EMAIL}@{domain}",
        "proxied": False
    }
    
    all_records = [a_record, mx_record, spf_record, dmarc_record]
    
    for record in all_records:
        try:
            response = requests.post(
                f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records",
                headers=headers,
                json=record
            )
            if response.status_code == 200:
                records_created.append(record["type"])
        except Exception as e:
            print(f"Error creating {record['type']} record: {e}")
    
    return {
        "configured": True,
        "zone_id": zone_id,
        "records": records_created,
        "message": f"Created {len(records_created)} DNS records"
    }

app = FastAPI(title="24MailAPI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database initialization
def init_db():
    os.makedirs(os.path.dirname(DATABASE_URL), exist_ok=True)
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    
    # Domains table
    c.execute('''CREATE TABLE IF NOT EXISTS domains (
        id TEXT PRIMARY KEY,
        domain TEXT UNIQUE NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )''')
    
    # Mailboxes table
    c.execute('''CREATE TABLE IF NOT EXISTS mailboxes (
        id TEXT PRIMARY KEY,
        address TEXT UNIQUE NOT NULL,
        domain_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (domain_id) REFERENCES domains(id)
    )''')
    
    # Add default domain if not exists
    c.execute("SELECT COUNT(*) FROM domains WHERE domain = ?", (DOMAIN,))
    if c.fetchone()[0] == 0:
        default_id = str(uuid.uuid4())
        c.execute("INSERT INTO domains (id, domain, is_default, created_at) VALUES (?, ?, 1, ?)",
                  (default_id, DOMAIN, datetime.now().isoformat()))
    
    # System logs table
    c.execute('''CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
    )''')
    
    conn.commit()
    conn.close()

init_db()

# Log Event Types
class LogEventType(str, Enum):
    MAILBOX_CREATED = "mailbox_created"
    MAILBOX_DELETED = "mailbox_deleted"
    MAILBOX_EXPIRED = "mailbox_expired"
    EMAIL_RECEIVED = "email_received"
    DOMAIN_ADDED = "domain_added"
    DOMAIN_DELETED = "domain_deleted"
    DNS_CONFIGURED = "dns_configured"
    API_REQUEST = "api_request"
    ERROR = "error"

# Log helper function
def add_log(event_type: str, message: str, details: str = None):
    try:
        conn = sqlite3.connect(DATABASE_URL)
        c = conn.cursor()
        c.execute(
            "INSERT INTO system_logs (event_type, message, details, created_at) VALUES (?, ?, ?, ?)",
            (event_type, message, details, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Failed to add log: {e}")

# Log API model
class LogResponse(BaseModel):
    id: int
    event_type: str
    message: str
    details: Optional[str] = None
    created_at: str

# Models
class DomainCreate(BaseModel):
    domain: str

class DomainResponse(BaseModel):
    id: str
    domain: str
    is_default: bool
    created_at: str
    dns_configured: Optional[bool] = False
    dns_message: Optional[str] = None

class DomainSelectionMode(str, Enum):
    DEFAULT = "default"      # Only use default domain
    ROUND_ROBIN = "round_robin"  # Rotate through domains
    RANDOM = "random"        # Randomly select domain
    SPECIFIC = "specific"    # Use specified domain

class MailboxCreate(BaseModel):
    address: Optional[str] = None  # If not provided, generate random
    domain_selection: Optional[DomainSelectionMode] = DomainSelectionMode.DEFAULT
    specific_domain: Optional[str] = None  # Required if domain_selection is SPECIFIC

class MailboxResponse(BaseModel):
    address: str
    domain: str
    created_at: str
    expires_at: str

class EmailResponse(BaseModel):
    id: str
    from_addr: str
    to_addr: str
    subject: str
    content: str
    html_content: Optional[str]
    timestamp: str

class CloudflareSetup(BaseModel):
    domain: str

# Authentication
def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True

# Helper functions
def generate_random_address(length=8):
    chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return ''.join(chars[ord(c) % len(chars)] for c in str(uuid.uuid4()) if c in chars)[:length]

def cleanup_expired_mailboxes():
    """Remove expired mailboxes and their emails"""
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    
    now = datetime.now().isoformat()
    c.execute("SELECT address FROM mailboxes WHERE expires_at < ?", (now,))
    expired = c.fetchall()
    
    for (addr,) in expired:
        # Delete email files
        email_file = os.path.join(MAIL_STORAGE_PATH, f"{addr}.json")
        if os.path.exists(email_file):
            os.remove(email_file)
    
    c.execute("DELETE FROM mailboxes WHERE expires_at < ?", (now,))
    conn.commit()
    conn.close()
    
    return len(expired)

# Domain endpoints
@app.post("/api/domains", response_model=DomainResponse)
def create_domain(domain: DomainCreate, auth: bool = Depends(verify_api_key)):
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    
    try:
        domain_id = str(uuid.uuid4())
        c.execute("INSERT INTO domains (id, domain, is_default, created_at) VALUES (?, ?, 0, ?)",
                  (domain_id, domain.domain, datetime.now().isoformat()))
        conn.commit()
        
        # Auto-configure DNS if Cloudflare is configured
        dns_config = auto_configure_dns(domain.domain)
        
        # Log the domain addition
        add_log(
            LogEventType.DOMAIN_ADDED,
            f"Domain added: {domain.domain}",
            f"DNS configured: {dns_config.get('configured', False)}"
        )
        
        return DomainResponse(
            id=domain_id,
            domain=domain.domain,
            is_default=False,
            created_at=datetime.now().isoformat(),
            dns_configured=dns_config.get("configured", False),
            dns_message=dns_config.get("message", "")
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Domain already exists")
    finally:
        conn.close()

@app.get("/api/domains", response_model=List[DomainResponse])
def list_domains(auth: bool = Depends(verify_api_key)):
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    c.execute("SELECT id, domain, is_default, created_at FROM domains")
    domains = c.fetchall()
    conn.close()
    
    return [DomainResponse(id=d[0], domain=d[1], is_default=bool(d[2]), created_at=d[3]) for d in domains]

@app.delete("/api/domains/{domain_id}")
def delete_domain(domain_id: str, auth: bool = Depends(verify_api_key)):
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    
    c.execute("SELECT is_default FROM domains WHERE id = ?", (domain_id,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        raise HTTPException(status_code=404, detail="Domain not found")
    
    if result[0]:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot delete default domain")
    
    c.execute("DELETE FROM domains WHERE id = ?", (domain_id,))
    conn.commit()
    
    # Get domain name before closing
    c.execute("SELECT domain FROM domains WHERE id = ?", (domain_id,))
    domain_result = c.fetchone()
    domain_name = domain_result[0] if domain_result else domain_id
    
    conn.close()
    
    # Log the deletion
    add_log(LogEventType.DOMAIN_DELETED, f"Domain deleted: {domain_name}")
    
    return {"message": "Domain deleted"}

# Mailbox endpoints
@app.post("/api/mailboxes", response_model=MailboxResponse)
def create_mailbox(mailbox: MailboxCreate, auth: bool = Depends(verify_api_key)):
    import random
    
    # Cleanup expired mailboxes first
    cleanup_expired_mailboxes()
    
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    
    # Get domain based on selection mode
    domain_id = None
    domain = None
    
    if mailbox.domain_selection == DomainSelectionMode.SPECIFIC:
        # Use specific domain if provided
        if not mailbox.specific_domain:
            conn.close()
            raise HTTPException(status_code=400, detail="specific_domain is required when using SPECIFIC mode")
        
        c.execute("SELECT id, domain FROM domains WHERE domain = ?", (mailbox.specific_domain,))
        result = c.fetchone()
        if not result:
            conn.close()
            raise HTTPException(status_code=404, detail="Domain not found")
        domain_id, domain = result
    
    elif mailbox.domain_selection == DomainSelectionMode.ROUND_ROBIN:
        # Get all domains and rotate
        c.execute("SELECT id, domain FROM domains")
        domains = c.fetchall()
        if not domains:
            conn.close()
            raise HTTPException(status_code=500, detail="No domains configured")
        
        # Get count of existing mailboxes to determine position
        c.execute("SELECT COUNT(*) FROM mailboxes")
        count = c.fetchone()[0]
        domain_id, domain = domains[count % len(domains)]
    
    elif mailbox.domain_selection == DomainSelectionMode.RANDOM:
        # Randomly select a domain
        c.execute("SELECT id, domain FROM domains")
        domains = c.fetchall()
        if not domains:
            conn.close()
            raise HTTPException(status_code=500, detail="No domains configured")
        
        domain_id, domain = random.choice(domains)
    
    else:  # DEFAULT or any other
        # Get default domain
        c.execute("SELECT id, domain FROM domains WHERE is_default = 1")
        result = c.fetchone()
        if not result:
            conn.close()
            raise HTTPException(status_code=500, detail="No default domain configured")
        domain_id, domain = result
    
    # Generate address if not provided
    address = mailbox.address or generate_random_address()
    full_address = f"{address}@{domain}"
    
    # Check if address exists
    c.execute("SELECT id FROM mailboxes WHERE address = ?", (full_address,))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Address already exists")
    
    # Create mailbox
    mailbox_id = str(uuid.uuid4())
    now = datetime.now()
    expires = now + timedelta(hours=MAIL_EXPIRY_HOURS)
    
    c.execute("INSERT INTO mailboxes (id, address, domain_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
              (mailbox_id, full_address, domain_id, now.isoformat(), expires.isoformat()))
    conn.commit()
    conn.close()
    
    # Log the mailbox creation
    add_log(
        LogEventType.MAILBOX_CREATED,
        f"Mailbox created: {full_address}",
        f"Domain: {domain}, Selection mode: {mailbox.domain_selection.value if mailbox.domain_selection else 'default'}"
    )
    
    return MailboxResponse(
        address=full_address,
        domain=domain,
        created_at=now.isoformat(),
        expires_at=expires.isoformat()
    )

@app.get("/api/mailboxes", response_model=List[MailboxResponse])
def list_mailboxes(auth: bool = Depends(verify_api_key)):
    # Cleanup expired mailboxes first
    cleanup_expired_mailboxes()
    
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    c.execute("""SELECT m.address, d.domain, m.created_at, m.expires_at 
                 FROM mailboxes m 
                 JOIN domains d ON m.domain_id = d.id 
                 WHERE m.expires_at > ?""", (datetime.now().isoformat(),))
    mailboxes = c.fetchall()
    conn.close()
    
    return [MailboxResponse(address=m[0], domain=m[1], created_at=m[2], expires_at=m[3]) for m in mailboxes]

@app.get("/api/mailboxes/{address}", response_model=List[EmailResponse])
def get_mailbox_emails(address: str, auth: bool = Depends(verify_api_key)):
    # Validate address format
    if "@" not in address:
        address = f"{address}@{DOMAIN}"
    
    # Check if mailbox exists and not expired
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    c.execute("SELECT expires_at FROM mailboxes WHERE address = ?", (address,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        raise HTTPException(status_code=404, detail="Mailbox not found")
    
    if datetime.fromisoformat(result[0]) < datetime.now():
        conn.close()
        raise HTTPException(status_code=410, detail="Mailbox expired")
    
    conn.close()
    
    # Get emails from file
    email_file = os.path.join(MAIL_STORAGE_PATH, f"{address.replace('@', '_at_')}.json")
    if not os.path.exists(email_file):
        return []
    
    with open(email_file, 'r') as f:
        emails = json.load(f)
    
    return [EmailResponse(
        id=str(i),
        from_addr=e["from"],
        to_addr=e["to"],
        subject=e["subject"],
        content=e.get("text_content", ""),
        html_content=e.get("html_content"),
        timestamp=e["timestamp"]
    ) for i, e in enumerate(emails)]

@app.delete("/api/mailboxes/{address}")
def delete_mailbox(address: str, auth: bool = Depends(verify_api_key)):
    if "@" not in address:
        address = f"{address}@{DOMAIN}"
    
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    
    c.execute("DELETE FROM mailboxes WHERE address = ?", (address,))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Mailbox not found")
    
    conn.commit()
    conn.close()
    
    # Log the deletion
    add_log(LogEventType.MAILBOX_DELETED, f"Mailbox deleted: {address}")
    
    # Delete email file
    email_file = os.path.join(MAIL_STORAGE_PATH, f"{address.replace('@', '_at_')}.json")
    if os.path.exists(email_file):
        os.remove(email_file)
    
    return {"message": "Mailbox deleted"}

# Cloudflare DNS endpoints (legacy - kept for backward compatibility)
@app.post("/api/cloudflare/setup")
def setup_cloudflare_dns(config: CloudflareSetup, auth: bool = Depends(verify_api_key)):
    if not CF_API_TOKEN or not CF_API_EMAIL:
        raise HTTPException(status_code=400, detail="Cloudflare not configured")
    
    # Auto-get zone_id from domain name
    zone_id = get_zone_id(config.domain)
    if not zone_id:
        raise HTTPException(status_code=404, detail=f"Domain {config.domain} not found in Cloudflare")
    
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    records = []
    
    # A Record for mail
    a_record = {
        "type": "A",
        "name": config.domain,
        "content": SERVER_IP,
        "proxied": False
    }
    
    # MX Record
    mx_record = {
        "type": "MX",
        "name": config.domain,
        "content": config.domain,
        "priority": 10,
        "proxied": False
    }
    
    # Create records
    for record in [a_record, mx_record]:
        response = requests.post(
            f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records",
            headers=headers,
            json=record
        )
        if response.status_code == 200:
            records.append(record)
    
    return {
        "message": "DNS records created",
        "records": records
    }

@app.get("/api/logs", response_model=List[LogResponse])
def get_logs(limit: int = 100, event_type: str = None, auth: bool = Depends(verify_api_key)):
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    
    if event_type:
        c.execute(
            "SELECT id, event_type, message, details, created_at FROM system_logs WHERE event_type = ? ORDER BY id DESC LIMIT ?",
            (event_type, limit)
        )
    else:
        c.execute(
            "SELECT id, event_type, message, details, created_at FROM system_logs ORDER BY id DESC LIMIT ?",
            (limit,)
        )
    
    logs = c.fetchall()
    conn.close()
    
    return [LogResponse(
        id=log[0],
        event_type=log[1],
        message=log[2],
        details=log[3],
        created_at=log[4]
    ) for log in logs]

@app.get("/api/health")
def health_check():
    return {"status": "ok", "mail_expiry_hours": MAIL_EXPIRY_HOURS}

# SMTP Handler
class MailHandler:
    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):
        envelope.rcpt_tos.append(address)
        return '250 OK'

    async def handle_DATA(self, server, session, envelope):
        parser = BytesParser(policy=default)
        message = parser.parsebytes(envelope.content)
        
        mail_to = envelope.rcpt_tos[0]
        mail_from = envelope.mail_from
        subject = message.get("subject", "")
        
        # Get plain text and HTML content
        text_content = ""
        html_content = None
        
        if message.is_multipart():
            for part in message.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain" and not text_content:
                    text_content = part.get_content()
                elif content_type == "text/html" and not html_content:
                    html_content = part.get_content()
        else:
            if message.get_content_type() == "text/plain":
                text_content = message.get_content()
            else:
                html_content = message.get_content()
        
        mail_data = {
            "from": mail_from,
            "to": mail_to,
            "subject": subject,
            "text_content": text_content,
            "html_content": html_content,
            "timestamp": datetime.now().isoformat()
        }
        
        # Save to file
        os.makedirs(MAIL_STORAGE_PATH, exist_ok=True)
        inbox_name = mail_to.replace("@", "_at_")
        inbox_path = os.path.join(MAIL_STORAGE_PATH, f"{inbox_name}.json")
        
        if os.path.exists(inbox_path):
            with open(inbox_path, 'r') as f:
                emails = json.load(f)
        else:
            emails = []
        
        emails.append(mail_data)
        
        with open(inbox_path, 'w') as f:
            json.dump(emails, f, indent=2)
        
        print(f"📥 Received email for {mail_to}: {subject}")
        return '250 Message accepted for delivery'

async def start_smtp_server():
    handler = MailHandler()
    controller = aiosmtpd.controller.Controller(handler, hostname="0.0.0.0", port=25)
    controller.start()
    print("📡 SMTP server running on port 25")

if __name__ == "__main__":
    import uvicorn
    
    # Start SMTP in background
    asyncio.run(start_smtp_server())
    
    # Run API
    uvicorn.run(app, host="0.0.0.0", port=8000)
