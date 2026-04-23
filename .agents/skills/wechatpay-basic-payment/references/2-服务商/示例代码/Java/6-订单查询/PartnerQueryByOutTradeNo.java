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
 * 微信支付商户订单号查询订单
 */
public class PartnerQueryByOutTradeNo {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/pay/partner/transactions/out-trade-no/{out_trade_no}";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    PartnerQueryByOutTradeNo client = new PartnerQueryByOutTradeNo(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    PartnerQueryByOutTradeNoRequest request = new PartnerQueryByOutTradeNoRequest();
    request.outTradeNo = "1217752501201407033233368018";
    request.spMchid = "1230000109";
    request.subMchid = "1900000109";
    try {
      PartnerAPIv3PartnerQueryResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public PartnerAPIv3PartnerQueryResponse run(PartnerQueryByOutTradeNoRequest request) {
    String uri = PATH;
    uri = uri.replace("{out_trade_no}", WXPayUtility.urlEncode(request.outTradeNo));
    Map<String, Object> args = new HashMap<>();
    args.put("sp_mchid", request.spMchid);
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
        return WXPayUtility.fromJson(respBody, PartnerAPIv3PartnerQueryResponse.class);
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

  public PartnerQueryByOutTradeNo(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class PartnerQueryByOutTradeNoRequest {
    @SerializedName("sp_mchid")
    @Expose(serialize = false)
    public String spMchid;

    @SerializedName("sub_mchid")
    @Expose(serialize = false)
    public String subMchid;

    @SerializedName("out_trade_no")
    @Expose(serialize = false)
    public String outTradeNo;
  }

  public static class PartnerAPIv3PartnerQueryResponse {
    @SerializedName("sp_appid")
    public String spAppid;

    @SerializedName("sp_mchid")
    public String spMchid;

    @SerializedName("sub_appid")
    public String subAppid;

    @SerializedName("sub_mchid")
    public String subMchid;

    @SerializedName("out_trade_no")
    public String outTradeNo;

    @SerializedName("transaction_id")
    public String transactionId;

    @SerializedName("trade_type")
    public String tradeType;

    @SerializedName("trade_state")
    public String tradeState;

    @SerializedName("trade_state_desc")
    public String tradeStateDesc;

    @SerializedName("bank_type")
    public String bankType;

    @SerializedName("attach")
    public String attach;

    @SerializedName("success_time")
    public String successTime;

    @SerializedName("payer")
    public PartnerCommRespPayerInfo payer;

    @SerializedName("amount")
    public CommRespAmountInfo amount;

    @SerializedName("scene_info")
    public CommRespSceneInfo sceneInfo;

    @SerializedName("promotion_detail")
    public List<PromotionDetail> promotionDetail;
  }

  public static class PartnerCommRespPayerInfo {
    @SerializedName("sp_openid")
    public String spOpenid;

    @SerializedName("sub_openid")
    public String subOpenid;
  }

  public static class CommRespAmountInfo {
    @SerializedName("total")
    public Long total;

    @SerializedName("payer_total")
    public Long payerTotal;

    @SerializedName("currency")
    public String currency;

    @SerializedName("payer_currency")
    public String payerCurrency;
  }

  public static class CommRespSceneInfo {
    @SerializedName("device_id")
    public String deviceId;
  }

  public static class PromotionDetail {
    @SerializedName("coupon_id")
    public String couponId;

    @SerializedName("name")
    public String name;

    @SerializedName("scope")
    public String scope;

    @SerializedName("type")
    public String type;

    @SerializedName("amount")
    public Long amount;

    @SerializedName("stock_id")
    public String stockId;

    @SerializedName("wechatpay_contribute")
    public Long wechatpayContribute;

    @SerializedName("merchant_contribute")
    public Long merchantContribute;

    @SerializedName("other_contribute")
    public Long otherContribute;

    @SerializedName("currency")
    public String currency;

    @SerializedName("goods_detail")
    public List<GoodsDetailInPromotion> goodsDetail;
  }

  public static class GoodsDetailInPromotion {
    @SerializedName("goods_id")
    public String goodsId;

    @SerializedName("quantity")
    public Long quantity;

    @SerializedName("unit_price")
    public Long unitPrice;

    @SerializedName("discount_amount")
    public Long discountAmount;

    @SerializedName("goods_remark")
    public String goodsRemark;
  }

}
