import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5401';

// 创建项目
async function createProject(title) {
  const response = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_type: 'idea',
      idea_prompt: title,
      template_style: '简约商务风格',
      image_aspect_ratio: '16:9'
    })
  });
  const data = await response.json();
  return data.data.project_id;
}

// 创建临时测试文件
function createTempFile(filename, content) {
  const tempDir = '/tmp/test-attachments';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filepath = path.join(tempDir, filename);
  fs.writeFileSync(filepath, content);
  return filepath;
}

// 上传参考文件
async function uploadFile(projectId, filename, content) {
  const filepath = createTempFile(filename, content);
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filepath));
  if (projectId) {
    formData.append('project_id', projectId);
  }

  const response = await fetch(`${BASE_URL}/api/reference-files`, {
    method: 'POST',
    body: formData
  });

  fs.unlinkSync(filepath);
  return response.json();
}

async function main() {
  console.log('Creating test projects and attachments...\n');

  const projects = [
    '产品发布会演示',
    '季度业绩报告',
    '市场营销策略',
    '技术架构设计',
    '团队培训材料'
  ];

  for (const title of projects) {
    console.log(`Creating project: ${title}`);
    const projectId = await createProject(title);

    // 为每个项目上传2-3个文件
    const fileCount = Math.floor(Math.random() * 2) + 2;
    for (let i = 0; i < fileCount; i++) {
      const filename = `${title.substring(0, 4)}_文档${i + 1}.txt`;
      const content = `这是 ${title} 的参考文档 ${i + 1}\n创建时间: ${new Date().toISOString()}`;
      await uploadFile(projectId, filename, content);
      console.log(`  - Uploaded: ${filename}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // 上传一些全局文件（不关联项目）
  console.log('\nCreating global attachments...');
  const globalFiles = ['通用模板.txt', '公司Logo说明.txt', '品牌指南.txt'];
  for (const filename of globalFiles) {
    await uploadFile(null, filename, `全局文件: ${filename}\n${new Date().toISOString()}`);
    console.log(`  - Uploaded: ${filename}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n✅ Test data created successfully!');
}

main().catch(console.error);
