/**
 * 图片上传
 *
 * 开户意愿确认资料中的图片需先通过本接口上传获取 MediaID，再将 MediaID 填入申请单对应字段。
 * POST /v3/merchant/media/upload
 */

String filePath = "/your/home/hellokitty.png";
URI uri = new URI("https://api.mch.weixin.qq.com/v3/merchant/media/upload");
File file = new File(filePath);
try (FileInputStream ins1 = new FileInputStream(file)) {
  String sha256 = DigestUtils.sha256Hex(ins1);
  try (InputStream ins2 = new FileInputStream(file)) {
    HttpPost request = new WechatPayUploadHttpPost.Builder(uri)
        .withImage(file.getName(), sha256, ins2)
        .build();
    CloseableHttpResponse response1 = httpClient.execute(request);
  }
}
