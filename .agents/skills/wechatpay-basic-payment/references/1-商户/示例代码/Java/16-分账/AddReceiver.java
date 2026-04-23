package com.java.demo;

import com.java.utils.WXPayUtility; // 引用微信支付工具库，参考：https://pay.weixin.qq.com/doc/v3/merchant/4014931831

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
 * 添加分账接收方
 */
public class AddReceiver {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/profitsharing/receivers/add";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/merchant/4013070756
    AddReceiver client = new AddReceiver(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/merchant/4013070756
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013053053
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013038816
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    AddReceiverRequest request = new AddReceiverRequest();
    request.appid = "wx8888888888888888";
    request.type = ReceiverType.MERCHANT_ID;
    request.account = "86693852";
    request.name = client.encrypt("name");
    request.relationType = ReceiverRelationType.STORE;
    request.customRelation = "代理商";
    try {
      AddReceiverResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public AddReceiverResponse run(AddReceiverRequest request) {
    String uri = PATH;
    String reqBody = WXPayUtility.toJson(request);

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayUtility.buildAuthorization(mchid, certificateSerialNo,privateKey, METHOD, uri, reqBody));
    reqBuilder.addHeader("Content-Type", "application/json");
    RequestBody requestBody = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), reqBody);
    reqBuilder.method(METHOD, requestBody);
    Request httpRequest = reqBuilder.build();

    // 发送HTTP请求
    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        // 2XX 成功，验证应答签名
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);

        // 从HTTP应答报文构建返回数据
        return WXPayUtility.fromJson(respBody, AddReceiverResponse.class);
      } else {
        throw new WXPayUtility.ApiException(httpResponse.code(), respBody, httpResponse.headers());
      }
    } catch (IOException e) {
      throw new UncheckedIOException("Sending request to " + uri + " failed.", e);
    }
  }

  private final String mchid;
  private final String certificateSerialNo;
  private final PrivateKey privateKey;
  private final String wechatPayPublicKeyId;
  private final PublicKey wechatPayPublicKey;

  public AddReceiver(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public String encrypt(String plainText) {
    return WXPayUtility.encrypt(this.wechatPayPublicKey, plainText);
  }

  public static class AddReceiverRequest {
    @SerializedName("appid")
    public String appid;
  
    @SerializedName("type")
    public ReceiverType type;
  
    @SerializedName("account")
    public String account;
  
    @SerializedName("name")
    public String name;
  
    @SerializedName("relation_type")
    public ReceiverRelationType relationType;
  
    @SerializedName("custom_relation")
    public String customRelation;
  }
  
  public static class AddReceiverResponse {
    @SerializedName("type")
    public ReceiverType type;
  
    @SerializedName("account")
    public String account;
  
    @SerializedName("name")
    public String name;
  
    @SerializedName("relation_type")
    public ReceiverRelationType relationType;
  
    @SerializedName("custom_relation")
    public String customRelation;
  }
  
  public enum ReceiverType {
    @SerializedName("MERCHANT_ID")
    MERCHANT_ID,
    @SerializedName("PERSONAL_OPENID")
    PERSONAL_OPENID
  }
  
  public enum ReceiverRelationType {
    @SerializedName("STORE")
    STORE,
    @SerializedName("STAFF")
    STAFF,
    @SerializedName("STORE_OWNER")
    STORE_OWNER,
    @SerializedName("PARTNER")
    PARTNER,
    @SerializedName("HEADQUARTER")
    HEADQUARTER,
    @SerializedName("BRAND")
    BRAND,
    @SerializedName("DISTRIBUTOR")
    DISTRIBUTOR,
    @SerializedName("USER")
    USER,
    @SerializedName("SUPPLIER")
    SUPPLIER,
    @SerializedName("CUSTOM")
    CUSTOM
  }
  
}
