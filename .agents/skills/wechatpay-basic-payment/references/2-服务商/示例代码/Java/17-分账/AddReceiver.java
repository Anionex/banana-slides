package com.java.demo;

import com.java.utils.WXPayUtility; // 引用微信支付工具库，参考：https://pay.weixin.qq.com/doc/v3/partner/4014985777

import com.google.gson.annotations.SerializedName;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.PrivateKey;
import java.security.PublicKey;

/**
 * 添加分账接收方（服务商模式）
 */
public class AddReceiver {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/profitsharing/receivers/add";

  public static void main(String[] args) {
    AddReceiver client = new AddReceiver(
      "19xxxxxxxx",
      "1DDE55AD98Exxxxxxxxxx",
      "/path/to/apiclient_key.pem",
      "PUB_KEY_ID_xxxxxxxxxxxxx",
      "/path/to/wxp_pub.pem"
    );

    AddReceiverRequest request = new AddReceiverRequest();
    request.subMchid = "1900000109";
    request.appid = "wx8888888888888888";
    request.subAppid = "wx8888888888888889";
    request.type = ReceiverType.MERCHANT_ID;
    request.account = "86693852";
    request.name = client.encrypt("name");
    request.relationType = ReceiverRelationType.STORE;
    request.customRelation = "代理商";
    try {
      AddReceiverResponse response = client.run(request);
      System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
      e.printStackTrace();
    }
  }

  public AddReceiverResponse run(AddReceiverRequest request) {
    String uri = PATH;
    String reqBody = WXPayUtility.toJson(request);

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayUtility.buildAuthorization(mchid, certificateSerialNo, privateKey, METHOD, uri, reqBody));
    reqBuilder.addHeader("Content-Type", "application/json");
    RequestBody requestBody = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), reqBody);
    reqBuilder.method(METHOD, requestBody);
    Request httpRequest = reqBuilder.build();

    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);
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
    @SerializedName("sub_mchid")
    public String subMchid;

    @SerializedName("appid")
    public String appid;

    @SerializedName("sub_appid")
    public String subAppid;

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
    PERSONAL_OPENID,
    @SerializedName("PERSONAL_SUB_OPENID")
    PERSONAL_SUB_OPENID
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
    CUSTOM,
    @SerializedName("SERVICE_PROVIDER")
    SERVICE_PROVIDER
  }

}
