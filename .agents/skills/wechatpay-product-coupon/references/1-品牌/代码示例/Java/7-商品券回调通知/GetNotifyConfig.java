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
 * 获取商品券事件通知地址
 */
public class GetNotifyConfig {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/brand/marketing/product-coupon/notify-configs";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/brand/4015415289
    GetNotifyConfig client = new GetNotifyConfig(
      "xxxxxxxx",                    // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考 https://pay.weixin.qq.com/doc/brand/4015415289
      "1DDE55AD98Exxxxxxxxxx",         // 品牌API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015407570
      "/path/to/apiclient_key.pem",     // 品牌API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015453439
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    try {
      GetNotifyConfigResponse response = client.run();
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayBrandUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public GetNotifyConfigResponse run() {
    String uri = PATH;

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayBrandUtility.buildAuthorization(brand_id, certificateSerialNo, privateKey, METHOD, uri, null));
    reqBuilder.method(METHOD, null);
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
        return WXPayBrandUtility.fromJson(respBody, GetNotifyConfigResponse.class);
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

  public GetNotifyConfig(String brand_id, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.brand_id = brand_id;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayBrandUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayBrandUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class GetNotifyConfigResponse {
    @SerializedName("notify_url")
    public String notifyUrl;
  
    @SerializedName("update_time")
    public String updateTime;
  }
  
}
