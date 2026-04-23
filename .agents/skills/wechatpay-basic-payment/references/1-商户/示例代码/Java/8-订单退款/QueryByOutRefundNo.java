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
 * 查询单笔退款（通过商户退款单号）
 *
 * 提交退款申请后，推荐每间隔1分钟调用该接口查询一次退款状态，若超过5分钟仍是退款处理中状态，
 * 建议开始逐步衰减查询频率(比如之后间隔5分钟、10分钟、20分钟、30分钟……查询一次)。
 *
 * 退款有一定延时，零钱支付的订单退款一般5分钟内到账，银行卡支付的订单退款一般1-3个工作日到账。
 *
 * 同一商户号查询退款频率限制为300qps，如返回FREQUENCY_LIMITED频率限制报错可间隔1分钟再重试查询。
 */
public class QueryByOutRefundNo {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/refund/domestic/refunds/{out_refund_no}";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/merchant/4013070756
    QueryByOutRefundNo client = new QueryByOutRefundNo(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/merchant/4013070756
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013053053
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013038816
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    QueryByOutRefundNoRequest request = new QueryByOutRefundNoRequest();
    request.outRefundNo = "1217752501201407033233368018";
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
    @SerializedName("CASH")
    CASH,
    @SerializedName("NOCASH")
    NOCASH
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
