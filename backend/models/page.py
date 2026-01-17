"""
Page model
"""
import uuid
import json
from datetime import datetime
from . import db


class Page(db.Model):
    """
    Page model - represents a single PPT page/slide
    """
    __tablename__ = 'pages'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = db.Column(db.String(36), db.ForeignKey('projects.id'), nullable=False)
    order_index = db.Column(db.Integer, nullable=False)
    part = db.Column(db.String(200), nullable=True)  # Optional section name
    outline_content = db.Column(db.Text, nullable=True)  # JSON string
    description_content = db.Column(db.Text, nullable=True)  # JSON string
    generated_image_path = db.Column(db.String(500), nullable=True)
    template_image_path = db.Column(db.String(500), nullable=True)  # Page-level template image path
    content_source = db.Column(db.Text, nullable=True)  # JSON: {"paragraph_ids": [], "image_ids": [], "table_ids": []}
    status = db.Column(db.String(50), nullable=False, default='DRAFT')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', back_populates='pages')
    image_versions = db.relationship('PageImageVersion', back_populates='page', 
                                     lazy='dynamic', cascade='all, delete-orphan',
                                     order_by='PageImageVersion.version_number.desc()')
    
    def get_outline_content(self):
        """Parse outline_content from JSON string"""
        if self.outline_content:
            try:
                return json.loads(self.outline_content)
            except json.JSONDecodeError:
                return None
        return None
    
    def set_outline_content(self, data):
        """Set outline_content as JSON string"""
        if data:
            self.outline_content = json.dumps(data, ensure_ascii=False)
        else:
            self.outline_content = None
    
    def get_description_content(self):
        """Parse description_content from JSON string"""
        if self.description_content:
            try:
                return json.loads(self.description_content)
            except json.JSONDecodeError:
                return None
        return None
    
    def set_description_content(self, data):
        """Set description_content as JSON string"""
        if data:
            self.description_content = json.dumps(data, ensure_ascii=False)
        else:
            self.description_content = None

    def get_content_source(self):
        """Parse content_source from JSON string"""
        if self.content_source:
            try:
                return json.loads(self.content_source)
            except json.JSONDecodeError:
                return None
        return None

    def set_content_source(self, data):
        """Set content_source as JSON string"""
        if data:
            self.content_source = json.dumps(data, ensure_ascii=False)
        else:
            self.content_source = None

    def to_dict(self, include_versions=False):
        """Convert to dictionary"""
        data = {
            'page_id': self.id,
            'order_index': self.order_index,
            'part': self.part,
            'outline_content': self.get_outline_content(),
            'description_content': self.get_description_content(),
            'content_source': self.get_content_source(),
            'generated_image_url': f'/files/{self.project_id}/pages/{self.generated_image_path.split("/")[-1]}' if self.generated_image_path else None,
            'template_image_url': f'/files/{self.project_id}/page_templates/{self.template_image_path.split("/")[-1]}' if self.template_image_path else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_versions:
            data['image_versions'] = [v.to_dict() for v in self.image_versions.all()]
        
        return data
    
    def __repr__(self):
        return f'<Page {self.id}: {self.order_index} - {self.status}>'

