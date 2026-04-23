package com.java.demo;

import com.java.utils.WXPayUtility; // 引用微信支付工具库，参考：https://pay.weixin.qq.com/doc/v3/partner/4014985777

import com.google.gson.annotations.SerializedName;
import com.google.gson.annotations.Expose;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.HashMap;
import java.util.Map;

/**
 * 申请分账账单（服务商模式）
 */
public class SplitBill {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/profitsharing/bills";

  public static void main(String[] args) {
    SplitBill client = new SplitBill(
      "19xxxxxxxx",
      "1DDE55AD98Exxxxxxxxxx",
      "/path/to/apiclient_key.pem",
      "PUB_KEY_ID_xxxxxxxxxxxxx",
      "/path/to/wxp_pub.pem"
    );

    SplitBillRequest request = new SplitBillRequest();
    request.subMchid = "1900000109";
    request.billDate = "2019-06-11";
    request.tarType = SplitBillTarType.GZIP;
    try {
      SplitBillResponse response = client.run(request);
      System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
      e.printStackTrace();
    }
  }

  public SplitBillResponse run(SplitBillRequest request) {
    String uri = PATH;
    Map<String, Object> args = new HashMap<>();
    args.put("sub_mchid", request.subMchid);
    args.put("bill_date", request.billDate);
    args.put("tar_type", request.tarType);
    String queryString = WXPayUtility.urlEncode(args);
    if (!queryString.isEmpty()) {
      uri = uri + "?" + queryString;
    }

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayUtility.buildAuthorization(mchid, certificateSerialNo, privateKey, METHOD, uri, null));
    reqBuilder.method(METHOD, null);
    Request httpRequest = reqBuilder.build();

    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);
        return WXPayUtility.fromJson(respBody, SplitBillResponse.class);
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

  public SplitBill(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class SplitBillRequest {
    @SerializedName("sub_mchid")
    @Expose(serialize = false)
    public String subMchid;

    @SerializedName("bill_date")
    @Expose(serialize = false)
    public String billDate;

    @SerializedName("tar_type")
    @Expose(serialize = false)
    public SplitBillTarType tarType;
  }

  public static class SplitBillResponse {
    @SerializedName("hash_type")
    public SplitBillHashType hashType;

    @SerializedName("hash_value")
    public String hashValue;

    @SerializedName("download_url")
    public String downloadUrl;
  }

  public enum SplitBillTarType {
    @SerializedName("GZIP")
    GZIP
  }

  public enum SplitBillHashType {
    @SerializedName("SHA1")
    SHA1
  }

}
