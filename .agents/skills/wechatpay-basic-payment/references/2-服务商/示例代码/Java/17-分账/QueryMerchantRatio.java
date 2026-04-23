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

/**
 * 查询最大分账比例（服务商独有）
 */
public class QueryMerchantRatio {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/profitsharing/merchant-configs/{sub_mchid}";

  public static void main(String[] args) {
    QueryMerchantRatio client = new QueryMerchantRatio(
      "19xxxxxxxx",
      "1DDE55AD98Exxxxxxxxxx",
      "/path/to/apiclient_key.pem",
      "PUB_KEY_ID_xxxxxxxxxxxxx",
      "/path/to/wxp_pub.pem"
    );

    QueryMerchantRatioRequest request = new QueryMerchantRatioRequest();
    request.subMchid = "1900000109";
    try {
      QueryMerchantRatioResponse response = client.run(request);
      System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
      e.printStackTrace();
    }
  }

  public QueryMerchantRatioResponse run(QueryMerchantRatioRequest request) {
    String uri = PATH;
    uri = uri.replace("{sub_mchid}", WXPayUtility.urlEncode(request.subMchid));

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
        return WXPayUtility.fromJson(respBody, QueryMerchantRatioResponse.class);
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

  public QueryMerchantRatio(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class QueryMerchantRatioRequest {
    @SerializedName("sub_mchid")
    @Expose(serialize = false)
    public String subMchid;
  }

  public static class QueryMerchantRatioResponse {
    @SerializedName("sub_mchid")
    public String subMchid;

    @SerializedName("max_ratio")
    public Long maxRatio;
  }

}
