package com.java.demo;

import com.java.utils.WXPayBrandUtility; // 引用微信支付工具库，参考：https://pay.weixin.qq.com/doc/brand/4015826861

import com.google.gson.annotations.SerializedName;
import com.google.gson.annotations.Expose;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 向用户预发放商品券（小程序发券组件）
 */
public class PreSendUserProductCoupon {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/brand/marketing/product-coupon/users/{openid}/pre-send-coupon";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/brand/4015415289
    PreSendUserProductCoupon client = new PreSendUserProductCoupon(
      "xxxxxxxx",                    // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考 https://pay.weixin.qq.com/doc/brand/4015415289
      "1DDE55AD98Exxxxxxxxxx",         // 品牌API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015407570
      "/path/to/apiclient_key.pem",     // 品牌API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015453439
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    PreSendUserProductCouponRequest request = new PreSendUserProductCouponRequest();
    request.openid = "oh-394z-6CGkNoJrsDLTTUKiAnp4";
    request.productCouponId = "200000001";
    request.stockId = "100232301";
    request.couponCode = "123446565767";
    request.appid = "wx233544546545989";
    request.sendRequestNo = "34657_20250101_123456";
    request.attach = "example_attach";
    try {
      PreSendUserProductCouponResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayBrandUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public PreSendUserProductCouponResponse run(PreSendUserProductCouponRequest request) {
    String uri = PATH;
    uri = uri.replace("{openid}", WXPayBrandUtility.urlEncode(request.openid));
    String reqBody = WXPayBrandUtility.toJson(request);

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayBrandUtility.buildAuthorization(brand_id, certificateSerialNo,privateKey, METHOD, uri, reqBody));
    reqBuilder.addHeader("Content-Type", "application/json");
    RequestBody requestBody = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), reqBody);
    reqBuilder.method(METHOD, requestBody);
    Request httpRequest = reqBuilder.build();

    // 发送HTTP请求
    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayBrandUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        // 2XX 成功，验证应答签名
        WXPayBrandUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);

        // 从HTTP应答报文构建返回数据
        return WXPayBrandUtility.fromJson(respBody, PreSendUserProductCouponResponse.class);
      } else {
        throw new WXPayBrandUtility.ApiException(httpResponse.code(), respBody, httpResponse.headers());
      }
    } catch (IOException e) {
      throw new UncheckedIOException("Sending request to " + uri + " failed.", e);
    }
  }

  private final String brand_id;
  private final String certificateSerialNo;
  private final PrivateKey privateKey;
  private final String wechatPayPublicKeyId;
  private final PublicKey wechatPayPublicKey;

  public PreSendUserProductCoupon(String brand_id, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.brand_id = brand_id;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayBrandUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayBrandUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class PreSendUserProductCouponRequest {
    @SerializedName("product_coupon_id")
    public String productCouponId;
  
    @SerializedName("stock_id")
    public String stockId;
  
    @SerializedName("coupon_code")
    public String couponCode;
  
    @SerializedName("appid")
    public String appid;
  
    @SerializedName("openid")
    @Expose(serialize = false)
    public String openid;
  
    @SerializedName("send_request_no")
    public String sendRequestNo;
  
    @SerializedName("attach")
    public String attach;
  }
  
  public static class PreSendUserProductCouponResponse {
    @SerializedName("token")
    public String token;
  }
  
}
