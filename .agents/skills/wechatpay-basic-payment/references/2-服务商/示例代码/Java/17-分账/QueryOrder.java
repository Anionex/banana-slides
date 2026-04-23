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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 查询分账结果（服务商模式）
 */
public class QueryOrder {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/profitsharing/orders/{out_order_no}";

  public static void main(String[] args) {
    QueryOrder client = new QueryOrder(
      "19xxxxxxxx",
      "1DDE55AD98Exxxxxxxxxx",
      "/path/to/apiclient_key.pem",
      "PUB_KEY_ID_xxxxxxxxxxxxx",
      "/path/to/wxp_pub.pem"
    );

    QueryOrderRequest request = new QueryOrderRequest();
    request.outOrderNo = "P20150806125346";
    request.subMchid = "1900000109";
    request.transactionId = "4208450740201411110007820472";
    try {
      OrdersEntity response = client.run(request);
      System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
      e.printStackTrace();
    }
  }

  public OrdersEntity run(QueryOrderRequest request) {
    String uri = PATH;
    uri = uri.replace("{out_order_no}", WXPayUtility.urlEncode(request.outOrderNo));
    Map<String, Object> args = new HashMap<>();
    args.put("sub_mchid", request.subMchid);
    args.put("transaction_id", request.transactionId);
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
        return WXPayUtility.fromJson(respBody, OrdersEntity.class);
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

  public QueryOrder(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class QueryOrderRequest {
    @SerializedName("sub_mchid")
    @Expose(serialize = false)
    public String subMchid;

    @SerializedName("transaction_id")
    @Expose(serialize = false)
    public String transactionId;

    @SerializedName("out_order_no")
    @Expose(serialize = false)
    public String outOrderNo;
  }

  public static class OrdersEntity {
    @SerializedName("sub_mchid")
    public String subMchid;

    @SerializedName("transaction_id")
    public String transactionId;

    @SerializedName("out_order_no")
    public String outOrderNo;

    @SerializedName("order_id")
    public String orderId;

    @SerializedName("state")
    public OrderStatus state;

    @SerializedName("receivers")
    public List<OrderReceiverDetail> receivers = new ArrayList<OrderReceiverDetail>();
  }

  public enum OrderStatus {
    @SerializedName("PROCESSING")
    PROCESSING,
    @SerializedName("FINISHED")
    FINISHED
  }

  public static class OrderReceiverDetail {
    @SerializedName("amount")
    public Long amount;

    @SerializedName("description")
    public String description;

    @SerializedName("type")
    public ReceiverType type;

    @SerializedName("account")
    public String account;

    @SerializedName("result")
    public DetailStatus result;

    @SerializedName("fail_reason")
    public DetailFailReason failReason;

    @SerializedName("create_time")
    public String createTime;

    @SerializedName("finish_time")
    public String finishTime;

    @SerializedName("detail_id")
    public String detailId;
  }

  public enum ReceiverType {
    @SerializedName("MERCHANT_ID")
    MERCHANT_ID,
    @SerializedName("PERSONAL_OPENID")
    PERSONAL_OPENID,
    @SerializedName("PERSONAL_SUB_OPENID")
    PERSONAL_SUB_OPENID
  }

  public enum DetailStatus {
    @SerializedName("PENDING")
    PENDING,
    @SerializedName("SUCCESS")
    SUCCESS,
    @SerializedName("CLOSED")
    CLOSED
  }

  public enum DetailFailReason {
    @SerializedName("ACCOUNT_ABNORMAL")
    ACCOUNT_ABNORMAL,
    @SerializedName("NO_RELATION")
    NO_RELATION,
    @SerializedName("RECEIVER_HIGH_RISK")
    RECEIVER_HIGH_RISK,
    @SerializedName("RECEIVER_REAL_NAME_NOT_VERIFIED")
    RECEIVER_REAL_NAME_NOT_VERIFIED,
    @SerializedName("NO_AUTH")
    NO_AUTH,
    @SerializedName("RECEIVER_RECEIPT_LIMIT")
    RECEIVER_RECEIPT_LIMIT,
    @SerializedName("PAYER_ACCOUNT_ABNORMAL")
    PAYER_ACCOUNT_ABNORMAL,
    @SerializedName("INVALID_REQUEST")
    INVALID_REQUEST
  }

}
