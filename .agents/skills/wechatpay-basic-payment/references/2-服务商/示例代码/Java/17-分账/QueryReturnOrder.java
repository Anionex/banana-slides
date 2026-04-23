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
 * 查询分账回退结果（服务商模式）
 */
public class QueryReturnOrder {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/profitsharing/return-orders/{out_return_no}";

  public static void main(String[] args) {
    QueryReturnOrder client = new QueryReturnOrder(
      "19xxxxxxxx",
      "1DDE55AD98Exxxxxxxxxx",
      "/path/to/apiclient_key.pem",
      "PUB_KEY_ID_xxxxxxxxxxxxx",
      "/path/to/wxp_pub.pem"
    );

    QueryReturnOrderRequest request = new QueryReturnOrderRequest();
    request.outReturnNo = "R20190516001";
    request.subMchid = "1900000109";
    request.outOrderNo = "P20190806125346";
    try {
      ReturnOrdersEntity response = client.run(request);
      System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
      e.printStackTrace();
    }
  }

  public ReturnOrdersEntity run(QueryReturnOrderRequest request) {
    String uri = PATH;
    uri = uri.replace("{out_return_no}", WXPayUtility.urlEncode(request.outReturnNo));
    Map<String, Object> args = new HashMap<>();
    args.put("sub_mchid", request.subMchid);
    args.put("out_order_no", request.outOrderNo);
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
        return WXPayUtility.fromJson(respBody, ReturnOrdersEntity.class);
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

  public QueryReturnOrder(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class QueryReturnOrderRequest {
    @SerializedName("out_return_no")
    @Expose(serialize = false)
    public String outReturnNo;

    @SerializedName("sub_mchid")
    @Expose(serialize = false)
    public String subMchid;

    @SerializedName("out_order_no")
    @Expose(serialize = false)
    public String outOrderNo;
  }

  public static class ReturnOrdersEntity {
    @SerializedName("sub_mchid")
    public String subMchid;

    @SerializedName("order_id")
    public String orderId;

    @SerializedName("out_order_no")
    public String outOrderNo;

    @SerializedName("out_return_no")
    public String outReturnNo;

    @SerializedName("return_id")
    public String returnId;

    @SerializedName("return_mchid")
    public String returnMchid;

    @SerializedName("amount")
    public Long amount;

    @SerializedName("description")
    public String description;

    @SerializedName("result")
    public ReturnOrderStatus result;

    @SerializedName("fail_reason")
    public ReturnOrderFailReason failReason;

    @SerializedName("create_time")
    public String createTime;

    @SerializedName("finish_time")
    public String finishTime;
  }

  public enum ReturnOrderStatus {
    @SerializedName("PROCESSING")
    PROCESSING,
    @SerializedName("SUCCESS")
    SUCCESS,
    @SerializedName("FAILED")
    FAILED
  }

  public enum ReturnOrderFailReason {
    @SerializedName("ACCOUNT_ABNORMAL")
    ACCOUNT_ABNORMAL,
    @SerializedName("BALANCE_NOT_ENOUGH")
    BALANCE_NOT_ENOUGH,
    @SerializedName("TIME_OUT_CLOSED")
    TIME_OUT_CLOSED,
    @SerializedName("PAYER_ACCOUNT_ABNORMAL")
    PAYER_ACCOUNT_ABNORMAL,
    @SerializedName("INVALID_REQUEST")
    INVALID_REQUEST
  }

}
