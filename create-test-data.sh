#!/bin/bash
BASE_URL="http://localhost:5401"

echo "Creating test projects and attachments..."

# 创建项目并上传文件
projects=("产品发布会演示" "季度业绩报告" "市场营销策略" "技术架构设计" "团队培训材料")

for title in "${projects[@]}"; do
  echo -e "\nCreating project: $title"
  
  # 创建项目
  response=$(curl -s -X POST "$BASE_URL/api/projects" \
    -H "Content-Type: application/json" \
    -d "{\"creation_type\":\"idea\",\"idea_prompt\":\"$title\",\"template_style\":\"简约商务风格\",\"image_aspect_ratio\":\"16:9\"}")
  
  project_id=$(echo $response | grep -o '"project_id":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$project_id" ]; then
    # 为每个项目上传2-3个文件
    for i in {1..3}; do
      filename="${title:0:8}_文档${i}.txt"
      echo "这是 $title 的参考文档 $i" > /tmp/test_file.txt
      
      curl -s -X POST "$BASE_URL/api/reference-files" \
        -F "file=@/tmp/test_file.txt;filename=$filename" \
        -F "project_id=$project_id" > /dev/null
      
      echo "  - Uploaded: $filename"
      sleep 0.2
    done
  fi
done

# 上传全局文件
echo -e "\nCreating global attachments..."
for name in "通用模板" "公司Logo说明" "品牌指南"; do
  filename="${name}.txt"
  echo "全局文件: $filename" > /tmp/test_file.txt
  
  curl -s -X POST "$BASE_URL/api/reference-files" \
    -F "file=@/tmp/test_file.txt;filename=$filename" > /dev/null
  
  echo "  - Uploaded: $filename"
  sleep 0.2
done

rm -f /tmp/test_file.txt
echo -e "\n✅ Test data created successfully!"
