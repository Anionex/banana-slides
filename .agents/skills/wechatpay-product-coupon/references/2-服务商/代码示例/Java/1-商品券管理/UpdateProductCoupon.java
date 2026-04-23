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
 * 修改商品券
 */
public class UpdateProductCoupon {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "PATCH";
  private static String PATH = "/v3/marketing/partner/product-coupon/product-coupons/{product_coupon_id}";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    UpdateProductCoupon client = new UpdateProductCoupon(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    UpdateProductCouponRequest request = new UpdateProductCouponRequest();
    request.outRequestNo = "12345_20250101_A3489";
    request.productCouponId = "1000000013";
    request.displayInfo = new ProductCouponDisplayInfo();
    request.displayInfo.name = "全场满100立打8折-新名字";
    request.displayInfo.imageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";
    request.displayInfo.backgroundUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";
    request.displayInfo.detailImageUrlList = new ArrayList<>();
    {
      request.displayInfo.detailImageUrlList.add("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx");
    };
    request.brandId = "120344";
    try {
      ProductCouponEntity response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public ProductCouponEntity run(UpdateProductCouponRequest request) {
    String uri = PATH;
    uri = uri.replace("{product_coupon_id}", WXPayUtility.urlEncode(request.productCouponId));
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
        return WXPayUtility.fromJson(respBody, ProductCouponEntity.class);
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

  public UpdateProductCoupon(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class UpdateProductCouponRequest {
    @SerializedName("out_request_no")
    public String outRequestNo;
  
    @SerializedName("product_coupon_id")
    @Expose(serialize = false)
    public String productCouponId;
  
    @SerializedName("display_info")
    public ProductCouponDisplayInfo displayInfo;
  
    @SerializedName("brand_id")
    public String brandId;
  }
  
  public static class ProductCouponEntity {
    @SerializedName("product_coupon_id")
    public String productCouponId;
  
    @SerializedName("scope")
    public ProductCouponScope scope;
  
    @SerializedName("type")
    public ProductCouponType type;
  
    @SerializedName("usage_mode")
    public UsageMode usageMode;
  
    @SerializedName("single_usage_info")
    public SingleUsageInfo singleUsageInfo;
  
    @SerializedName("progressive_bundle_usage_info")
    public ProgressiveBundleUsageInfo progressiveBundleUsageInfo;
  
    @SerializedName("display_info")
    public ProductCouponDisplayInfo displayInfo;
  
    @SerializedName("out_product_no")
    public String outProductNo;
  
    @SerializedName("state")
    public ProductCouponState state;
  
    @SerializedName("deactivate_request_no")
    public String deactivateRequestNo;
  
    @SerializedName("deactivate_time")
    public String deactivateTime;
  
    @SerializedName("deactivate_reason")
    public String deactivateReason;
  
    @SerializedName("brand_id")
    public String brandId;
  }
  
  public static class ProductCouponDisplayInfo {
    @SerializedName("name")
    public String name;
  
    @SerializedName("image_url")
    public String imageUrl;
  
    @SerializedName("background_url")
    public String backgroundUrl;
  
    @SerializedName("detail_image_url_list")
    public List<String> detailImageUrlList;
  
    @SerializedName("original_price")
    public Long originalPrice;
  
    @SerializedName("combo_package_list")
    public List<ComboPackage> comboPackageList;
  }
  
  public enum ProductCouponScope {
    @SerializedName("ALL")
    ALL,
    @SerializedName("SINGLE")
    SINGLE
  }
  
  public enum ProductCouponType {
    @SerializedName("NORMAL")
    NORMAL,
    @SerializedName("DISCOUNT")
    DISCOUNT,
    @SerializedName("EXCHANGE")
    EXCHANGE
  }
  
  public enum UsageMode {
    @SerializedName("SINGLE")
    SINGLE,
    @SerializedName("PROGRESSIVE_BUNDLE")
    PROGRESSIVE_BUNDLE
  }
  
  public static class SingleUsageInfo {
    @SerializedName("normal_coupon")
    public NormalCouponUsageRule normalCoupon;
  
    @SerializedName("discount_coupon")
    public DiscountCouponUsageRule discountCoupon;
  }
  
  public static class ProgressiveBundleUsageInfo {
    @SerializedName("count")
    public Long count;
  
    @SerializedName("interval_days")
    public Long intervalDays;
  }
  
  public enum ProductCouponState {
    @SerializedName("AUDITING")
    AUDITING,
    @SerializedName("EFFECTIVE")
    EFFECTIVE,
    @SerializedName("DEACTIVATED")
    DEACTIVATED
  }
  
  public static class ComboPackage {
    @SerializedName("name")
    public String name;
  
    @SerializedName("pick_count")
    public Long pickCount;
  
    @SerializedName("choice_list")
    public List<ComboPackageChoice> choiceList = new ArrayList<ComboPackageChoice>();
  }
  
  public static class NormalCouponUsageRule {
    @SerializedName("threshold")
    public Long threshold;
  
    @SerializedName("discount_amount")
    public Long discountAmount;
  }
  
  public static class DiscountCouponUsageRule {
    @SerializedName("threshold")
    public Long threshold;
  
    @SerializedName("percent_off")
    public Long percentOff;
  }
  
  public static class ComboPackageChoice {
    @SerializedName("name")
    public String name;
  
    @SerializedName("price")
    public Long price;
  
    @SerializedName("count")
    public Long count;
  
    @SerializedName("image_url")
    public String imageUrl;
  
    @SerializedName("mini_program_appid")
    public String miniProgramAppid;
  
    @SerializedName("mini_program_path")
    public String miniProgramPath;
  }
  
}
