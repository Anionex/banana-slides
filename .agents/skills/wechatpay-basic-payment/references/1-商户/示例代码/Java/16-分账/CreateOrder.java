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
 * 请求分账
 */
public class CreateOrder {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/profitsharing/orders";

  public static void main(String[] args) {
    CreateOrder client = new CreateOrder(
      "19xxxxxxxx",
      "1DDE55AD98Exxxxxxxxxx",
      "/path/to/apiclient_key.pem",
      "PUB_KEY_ID_xxxxxxxxxxxxx",
      "/path/to/wxp_pub.pem"
    );

    CreateOrderRequest request = new CreateOrderRequest();
    request.appid = "wx8888888888888888";
    request.transactionId = "4208450740201411110007820472";
    request.outOrderNo = "P20150806125346";
    request.receivers = new ArrayList<>();
    {
      CreateOrderReceiver receiversItem = new CreateOrderReceiver();
      receiversItem.type = "MERCHANT_ID";
      receiversItem.account = "86693852";
      receiversItem.name = client.encrypt("name");
      receiversItem.amount = 888L;
      receiversItem.description = "分给商户A";
      request.receivers.add(receiversItem);
    };
    request.unfreezeUnsplit = true;
    try {
      OrdersEntity response = client.run(request);
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        e.printStackTrace();
    }
  }

  public OrdersEntity run(CreateOrderRequest request) {
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

  public CreateOrder(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public String encrypt(String plainText) {
    return WXPayUtility.encrypt(this.wechatPayPublicKey, plainText);
  }

  public static class CreateOrderRequest {
    @SerializedName("appid")
    public String appid;

    @SerializedName("transaction_id")
    public String transactionId;

    @SerializedName("out_order_no")
    public String outOrderNo;

    @SerializedName("receivers")
    public List<CreateOrderReceiver> receivers = new ArrayList<CreateOrderReceiver>();

    @SerializedName("unfreeze_unsplit")
    public Boolean unfreezeUnsplit;
  }

  public static class OrdersEntity {
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

  public static class CreateOrderReceiver {
    @SerializedName("type")
    public String type;

    @SerializedName("account")
    public String account;

    @SerializedName("name")
    public String name;

    @SerializedName("amount")
    public Long amount;

    @SerializedName("description")
    public String description;
  }

  public enum OrderStatus {
    @SerializedName("PROCESSING") PROCESSING,
    @SerializedName("FINISHED") FINISHED
  }

  public static class OrderReceiverDetail {
    @SerializedName("amount") public Long amount;
    @SerializedName("description") public String description;
    @SerializedName("type") public ReceiverType type;
    @SerializedName("account") public String account;
    @SerializedName("result") public DetailStatus result;
    @SerializedName("fail_reason") public DetailFailReason failReason;
    @SerializedName("create_time") public String createTime;
    @SerializedName("finish_time") public String finishTime;
    @SerializedName("detail_id") public String detailId;
  }

  public enum ReceiverType {
    @SerializedName("MERCHANT_ID") MERCHANT_ID,
    @SerializedName("PERSONAL_OPENID") PERSONAL_OPENID
  }

  public enum DetailStatus {
    @SerializedName("PENDING") PENDING,
    @SerializedName("SUCCESS") SUCCESS,
    @SerializedName("CLOSED") CLOSED
  }

  public enum DetailFailReason {
    @SerializedName("ACCOUNT_ABNORMAL") ACCOUNT_ABNORMAL,
    @SerializedName("NO_RELATION") NO_RELATION,
    @SerializedName("RECEIVER_HIGH_RISK") RECEIVER_HIGH_RISK,
    @SerializedName("RECEIVER_REAL_NAME_NOT_VERIFIED") RECEIVER_REAL_NAME_NOT_VERIFIED,
    @SerializedName("NO_AUTH") NO_AUTH,
    @SerializedName("RECEIVER_RECEIPT_LIMIT") RECEIVER_RECEIPT_LIMIT,
    @SerializedName("PAYER_ACCOUNT_ABNORMAL") PAYER_ACCOUNT_ABNORMAL,
    @SerializedName("INVALID_REQUEST") INVALID_REQUEST
  }

}
