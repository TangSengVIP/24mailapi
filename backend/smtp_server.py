#!/usr/bin/env python3
import asyncio
import os
import json
from datetime import datetime
import aiosmtpd.controller
from email.parser import BytesParser
from email.policy import default

MAIL_STORAGE_PATH = os.getenv('MAIL_STORAGE_PATH', '/app/mailstore')

class MailHandler:
    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):
        envelope.rcpt_tos.append(address)
        return '250 OK'

    async def handle_DATA(self, server, session, envelope):
        parser = BytesParser(policy=default)
        message = parser.parsebytes(envelope.content)
        
        mail_to = envelope.rcpt_tos[0]
        mail_from = envelope.mail_from
        subject = message.get('subject', '')
        
        text_content = ''
        html_content = None
        
        if message.is_multipart():
            for part in message.walk():
                content_type = part.get_content_type()
                if content_type == 'text/plain' and not text_content:
                    text_content = part.get_content()
                elif content_type == 'text/html' and not html_content:
                    html_content = part.get_content()
        else:
            if message.get_content_type() == 'text/plain':
                text_content = message.get_content()
            else:
                html_content = message.get_content()
        
        mail_data = {
            'from': mail_from,
            'to': mail_to,
            'subject': subject,
            'text_content': text_content,
            'html_content': html_content,
            'timestamp': datetime.now().isoformat()
        }
        
        os.makedirs(MAIL_STORAGE_PATH, exist_ok=True)
        inbox_name = mail_to.replace('@', '_at_')
        inbox_path = os.path.join(MAIL_STORAGE_PATH, f'{inbox_name}.json')
        
        if os.path.exists(inbox_path):
            with open(inbox_path, 'r') as f:
                emails = json.load(f)
        else:
            emails = []
        
        emails.append(mail_data)
        
        with open(inbox_path, 'w') as f:
            json.dump(emails, f, indent=2)
        
        print(f'📥 Received email for {mail_to}: {subject}')
        return '250 Message accepted for delivery'

async def main():
    handler = MailHandler()
    controller = aiosmtpd.controller.Controller(handler, hostname='0.0.0.0', port=25)
    controller.start()
    print('📡 SMTP server running on port 25')
    
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())
