package com.java.demo;

import com.java.utils.WXPayUtility; // 引用微信支付工具库，参考：https://pay.weixin.qq.com/doc/v3/partner/4014985777

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
 * 查询单笔退款（通过商户退款单号）
 */
public class QueryByOutRefundNo {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/refund/domestic/refunds/{out_refund_no}";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    QueryByOutRefundNo client = new QueryByOutRefundNo(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    QueryByOutRefundNoRequest request = new QueryByOutRefundNoRequest();
    request.outRefundNo = "1217752501201407033233368018";
    request.subMchid = "1900000109";
    try {
      Refund response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public Refund run(QueryByOutRefundNoRequest request) {
    String uri = PATH;
    uri = uri.replace("{out_refund_no}", WXPayUtility.urlEncode(request.outRefundNo));
    Map<String, Object> args = new HashMap<>();
    args.put("sub_mchid", request.subMchid);
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

    // 发送HTTP请求
    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        // 2XX 成功，验证应答签名
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);

        // 从HTTP应答报文构建返回数据
        return WXPayUtility.fromJson(respBody, Refund.class);
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

  public QueryByOutRefundNo(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class QueryByOutRefundNoRequest {
    @SerializedName("out_refund_no")
    @Expose(serialize = false)
    public String outRefundNo;

    @SerializedName("sub_mchid")
    @Expose(serialize = false)
    public String subMchid;
  }

  public static class Refund {
    @SerializedName("refund_id")
    public String refundId;

    @SerializedName("out_refund_no")
    public String outRefundNo;

    @SerializedName("transaction_id")
    public String transactionId;

    @SerializedName("out_trade_no")
    public String outTradeNo;

    @SerializedName("channel")
    public Channel channel;

    @SerializedName("user_received_account")
    public String userReceivedAccount;

    @SerializedName("success_time")
    public String successTime;

    @SerializedName("create_time")
    public String createTime;

    @SerializedName("status")
    public Status status;

    @SerializedName("funds_account")
    public FundsAccount fundsAccount;

    @SerializedName("amount")
    public Amount amount;

    @SerializedName("promotion_detail")
    public List<Promotion> promotionDetail;

    @SerializedName("refund_account")
    public RefundAccount refundAccount;
  }

  public enum Channel {
    @SerializedName("ORIGINAL")
    ORIGINAL,
    @SerializedName("BALANCE")
    BALANCE,
    @SerializedName("OTHER_BALANCE")
    OTHER_BALANCE,
    @SerializedName("OTHER_BANKCARD")
    OTHER_BANKCARD
  }

  public enum Status {
    @SerializedName("SUCCESS")
    SUCCESS,
    @SerializedName("CLOSED")
    CLOSED,
    @SerializedName("PROCESSING")
    PROCESSING,
    @SerializedName("ABNORMAL")
    ABNORMAL
  }

  public enum FundsAccount {
    @SerializedName("UNSETTLED")
    UNSETTLED,
    @SerializedName("AVAILABLE")
    AVAILABLE,
    @SerializedName("UNAVAILABLE")
    UNAVAILABLE,
    @SerializedName("OPERATION")
    OPERATION,
    @SerializedName("BASIC")
    BASIC,
    @SerializedName("ECNY_BASIC")
    ECNY_BASIC
  }

  public static class Amount {
    @SerializedName("total")
    public Long total;

    @SerializedName("refund")
    public Long refund;

    @SerializedName("from")
    public List<FundsFromItem> from;

    @SerializedName("payer_total")
    public Long payerTotal;

    @SerializedName("payer_refund")
    public Long payerRefund;

    @SerializedName("settlement_refund")
    public Long settlementRefund;

    @SerializedName("settlement_total")
    public Long settlementTotal;

    @SerializedName("discount_refund")
    public Long discountRefund;

    @SerializedName("currency")
    public String currency;

    @SerializedName("refund_fee")
    public Long refundFee;

    @SerializedName("advance")
    public Long advance;
  }

  public static class Promotion {
    @SerializedName("promotion_id")
    public String promotionId;

    @SerializedName("scope")
    public PromotionScope scope;

    @SerializedName("type")
    public PromotionType type;

    @SerializedName("amount")
    public Long amount;

    @SerializedName("refund_amount")
    public Long refundAmount;

    @SerializedName("goods_detail")
    public List<GoodsDetail> goodsDetail;
  }

  public enum RefundAccount {
    @SerializedName("REFUND_SOURCE_PARTNER_ADVANCE")
    REFUND_SOURCE_PARTNER_ADVANCE,
    @SerializedName("REFUND_SOURCE_SUB_MERCHANT")
    REFUND_SOURCE_SUB_MERCHANT,
    @SerializedName("REFUND_SOURCE_SUB_MERCHANT_ADVANCE")
    REFUND_SOURCE_SUB_MERCHANT_ADVANCE
  }

  public static class FundsFromItem {
    @SerializedName("account")
    public Account account;

    @SerializedName("amount")
    public Long amount;
  }

  public enum PromotionScope {
    @SerializedName("GLOBAL")
    GLOBAL,
    @SerializedName("SINGLE")
    SINGLE
  }

  public enum PromotionType {
    @SerializedName("COUPON")
    COUPON,
    @SerializedName("DISCOUNT")
    DISCOUNT
  }

  public static class GoodsDetail {
    @SerializedName("merchant_goods_id")
    public String merchantGoodsId;

    @SerializedName("wechatpay_goods_id")
    public String wechatpayGoodsId;

    @SerializedName("goods_name")
    public String goodsName;

    @SerializedName("unit_price")
    public Long unitPrice;

    @SerializedName("refund_amount")
    public Long refundAmount;

    @SerializedName("refund_quantity")
    public Long refundQuantity;
  }

  public enum Account {
    @SerializedName("AVAILABLE")
    AVAILABLE,
    @SerializedName("UNAVAILABLE")
    UNAVAILABLE
  }

}
