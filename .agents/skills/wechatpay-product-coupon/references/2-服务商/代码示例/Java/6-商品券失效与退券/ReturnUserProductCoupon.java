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
 * 退券
 */
public class ReturnUserProductCoupon {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/marketing/partner/product-coupon/users/{openid}/coupons/{coupon_code}/return";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    ReturnUserProductCoupon client = new ReturnUserProductCoupon(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    ReturnUserProductCouponRequest request = new ReturnUserProductCouponRequest();
    request.productCouponId = "1000000013";
    request.stockId = "1000000013001";
    request.couponCode = "Code_123456";
    request.appid = "wx233544546545989";
    request.openid = "oh-394z-6CGkNoJrsDLTTUKiAnp4";
    request.outRequestNo = "MCHRETURN202003101234";
    request.brandId = "120344";
    try {
      UserProductCouponEntity response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public UserProductCouponEntity run(ReturnUserProductCouponRequest request) {
    String uri = PATH;
    uri = uri.replace("{coupon_code}", WXPayUtility.urlEncode(request.couponCode));
    uri = uri.replace("{openid}", WXPayUtility.urlEncode(request.openid));
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
        return WXPayUtility.fromJson(respBody, UserProductCouponEntity.class);
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

  public ReturnUserProductCoupon(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class ReturnUserProductCouponRequest {
    @SerializedName("product_coupon_id")
    public String productCouponId;
  
    @SerializedName("stock_id")
    public String stockId;
  
    @SerializedName("coupon_code")
    @Expose(serialize = false)
    public String couponCode;
  
    @SerializedName("appid")
    public String appid;
  
    @SerializedName("openid")
    @Expose(serialize = false)
    public String openid;
  
    @SerializedName("out_request_no")
    public String outRequestNo;
  
    @SerializedName("brand_id")
    public String brandId;
  }
  
  public static class UserProductCouponEntity {
    @SerializedName("coupon_code")
    public String couponCode;
  
    @SerializedName("coupon_state")
    public UserProductCouponState couponState;
  
    @SerializedName("valid_begin_time")
    public String validBeginTime;
  
    @SerializedName("valid_end_time")
    public String validEndTime;
  
    @SerializedName("receive_time")
    public String receiveTime;
  
    @SerializedName("send_request_no")
    public String sendRequestNo;
  
    @SerializedName("send_channel")
    public UserProductCouponSendChannel sendChannel;
  
    @SerializedName("confirm_request_no")
    public String confirmRequestNo;
  
    @SerializedName("confirm_time")
    public String confirmTime;
  
    @SerializedName("deactivate_request_no")
    public String deactivateRequestNo;
  
    @SerializedName("deactivate_time")
    public String deactivateTime;
  
    @SerializedName("deactivate_reason")
    public String deactivateReason;
  
    @SerializedName("single_usage_detail")
    public CouponUsageDetail singleUsageDetail;
  
    @SerializedName("progressive_bundle_usage_detail")
    public CouponUsageDetail progressiveBundleUsageDetail;
  
    @SerializedName("user_product_coupon_bundle_info")
    public UserProductCouponBundleInfo userProductCouponBundleInfo;
  
    @SerializedName("product_coupon")
    public ProductCouponEntity productCoupon;
  
    @SerializedName("stock")
    public StockEntity stock;
  
    @SerializedName("attach")
    public String attach;
  
    @SerializedName("channel_custom_info")
    public String channelCustomInfo;
  
    @SerializedName("coupon_tag_info")
    public CouponTagInfo couponTagInfo;
  
    @SerializedName("brand_id")
    public String brandId;
  }
  
  public enum UserProductCouponState {
    @SerializedName("CONFIRMING")
    CONFIRMING,
    @SerializedName("PENDING")
    PENDING,
    @SerializedName("EFFECTIVE")
    EFFECTIVE,
    @SerializedName("USED")
    USED,
    @SerializedName("EXPIRED")
    EXPIRED,
    @SerializedName("DELETED")
    DELETED,
    @SerializedName("DEACTIVATED")
    DEACTIVATED
  }
  
  public enum UserProductCouponSendChannel {
    @SerializedName("BRAND_MANAGE")
    BRAND_MANAGE,
    @SerializedName("API")
    API,
    @SerializedName("RECEIVE_COMPONENT")
    RECEIVE_COMPONENT
  }
  
  public static class CouponUsageDetail {
    @SerializedName("use_request_no")
    public String useRequestNo;
  
    @SerializedName("use_time")
    public String useTime;
  
    @SerializedName("return_request_no")
    public String returnRequestNo;
  
    @SerializedName("return_time")
    public String returnTime;
  
    @SerializedName("associated_order_info")
    public UserProductCouponAssociatedOrderInfo associatedOrderInfo;
  
    @SerializedName("associated_pay_score_order_info")
    public UserProductCouponAssociatedPayScoreOrderInfo associatedPayScoreOrderInfo;
  }
  
  public static class UserProductCouponBundleInfo {
    @SerializedName("user_coupon_bundle_id")
    public String userCouponBundleId;
  
    @SerializedName("user_coupon_bundle_index")
    public Long userCouponBundleIndex;
  
    @SerializedName("total_count")
    public Long totalCount;
  
    @SerializedName("used_count")
    public Long usedCount;
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
  
  public static class StockEntity {
    @SerializedName("product_coupon_id")
    public String productCouponId;
  
    @SerializedName("stock_id")
    public String stockId;
  
    @SerializedName("remark")
    public String remark;
  
    @SerializedName("coupon_code_mode")
    public CouponCodeMode couponCodeMode;
  
    @SerializedName("coupon_code_count_info")
    public CouponCodeCountInfo couponCodeCountInfo;
  
    @SerializedName("stock_send_rule")
    public StockSendRule stockSendRule;
  
    @SerializedName("single_usage_rule")
    public SingleUsageRule singleUsageRule;
  
    @SerializedName("progressive_bundle_usage_rule")
    public StockUsageRule progressiveBundleUsageRule;
  
    @SerializedName("stock_bundle_info")
    public StockBundleInfo stockBundleInfo;
  
    @SerializedName("usage_rule_display_info")
    public UsageRuleDisplayInfo usageRuleDisplayInfo;
  
    @SerializedName("coupon_display_info")
    public CouponDisplayInfo couponDisplayInfo;
  
    @SerializedName("notify_config")
    public NotifyConfig notifyConfig;
  
    @SerializedName("store_scope")
    public StockStoreScope storeScope;
  
    @SerializedName("sent_count_info")
    public StockSentCountInfo sentCountInfo;
  
    @SerializedName("state")
    public StockState state;
  
    @SerializedName("deactivate_request_no")
    public String deactivateRequestNo;
  
    @SerializedName("deactivate_time")
    public String deactivateTime;
  
    @SerializedName("deactivate_reason")
    public String deactivateReason;
  
    @SerializedName("brand_id")
    public String brandId;
  }
  
  public static class CouponTagInfo {
    @SerializedName("coupon_tag_list")
    public List<UserProductCouponTag> couponTagList;
  
    @SerializedName("member_tag_info")
    public MemberTagInfo memberTagInfo;
  }
  
  public static class UserProductCouponAssociatedOrderInfo {
    @SerializedName("transaction_id")
    public String transactionId;
  
    @SerializedName("out_trade_no")
    public String outTradeNo;
  
    @SerializedName("mchid")
    public String mchid;
  
    @SerializedName("sub_mchid")
    public String subMchid;
  }
  
  public static class UserProductCouponAssociatedPayScoreOrderInfo {
    @SerializedName("order_id")
    public String orderId;
  
    @SerializedName("out_order_no")
    public String outOrderNo;
  
    @SerializedName("mchid")
    public String mchid;
  
    @SerializedName("sub_mchid")
    public String subMchid;
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
  
  public enum ProductCouponState {
    @SerializedName("AUDITING")
    AUDITING,
    @SerializedName("EFFECTIVE")
    EFFECTIVE,
    @SerializedName("DEACTIVATED")
    DEACTIVATED
  }
  
  public enum CouponCodeMode {
    @SerializedName("WECHATPAY")
    WECHATPAY,
    @SerializedName("UPLOAD")
    UPLOAD,
    @SerializedName("API_ASSIGN")
    API_ASSIGN
  }
  
  public static class CouponCodeCountInfo {
    @SerializedName("total_count")
    public Long totalCount;
  
    @SerializedName("available_count")
    public Long availableCount;
  }
  
  public static class StockSendRule {
    @SerializedName("max_count")
    public Long maxCount;
  
    @SerializedName("max_count_per_day")
    public Long maxCountPerDay;
  
    @SerializedName("max_count_per_user")
    public Long maxCountPerUser;
  }
  
  public static class SingleUsageRule {
    @SerializedName("coupon_available_period")
    public CouponAvailablePeriod couponAvailablePeriod;
  
    @SerializedName("normal_coupon")
    public NormalCouponUsageRule normalCoupon;
  
    @SerializedName("discount_coupon")
    public DiscountCouponUsageRule discountCoupon;
  
    @SerializedName("exchange_coupon")
    public ExchangeCouponUsageRule exchangeCoupon;
  }
  
  public static class StockUsageRule {
    @SerializedName("coupon_available_period")
    public CouponAvailablePeriod couponAvailablePeriod;
  
    @SerializedName("normal_coupon")
    public NormalCouponUsageRule normalCoupon;
  
    @SerializedName("discount_coupon")
    public DiscountCouponUsageRule discountCoupon;
  
    @SerializedName("exchange_coupon")
    public ExchangeCouponUsageRule exchangeCoupon;
  }
  
  public static class StockBundleInfo {
    @SerializedName("stock_bundle_id")
    public String stockBundleId;
  
    @SerializedName("stock_bundle_index")
    public Long stockBundleIndex;
  }
  
  public static class UsageRuleDisplayInfo {
    @SerializedName("coupon_usage_method_list")
    public List<CouponUsageMethod> couponUsageMethodList = new ArrayList<CouponUsageMethod>();
  
    @SerializedName("mini_program_appid")
    public String miniProgramAppid;
  
    @SerializedName("mini_program_path")
    public String miniProgramPath;
  
    @SerializedName("app_path")
    public String appPath;
  
    @SerializedName("usage_description")
    public String usageDescription;
  
    @SerializedName("coupon_available_store_info")
    public CouponAvailableStoreInfo couponAvailableStoreInfo;
  }
  
  public static class CouponDisplayInfo {
    @SerializedName("code_display_mode")
    public CouponCodeDisplayMode codeDisplayMode;
  
    @SerializedName("background_color")
    public String backgroundColor;
  
    @SerializedName("entrance_mini_program")
    public EntranceMiniProgram entranceMiniProgram;
  
    @SerializedName("entrance_official_account")
    public EntranceOfficialAccount entranceOfficialAccount;
  
    @SerializedName("entrance_finder")
    public EntranceFinder entranceFinder;
  }
  
  public static class NotifyConfig {
    @SerializedName("notify_appid")
    public String notifyAppid;
  }
  
  public enum StockStoreScope {
    @SerializedName("NONE")
    NONE,
    @SerializedName("ALL")
    ALL,
    @SerializedName("SPECIFIC")
    SPECIFIC
  }
  
  public static class StockSentCountInfo {
    @SerializedName("total_count")
    public Long totalCount;
  
    @SerializedName("today_count")
    public Long todayCount;
  }
  
  public enum StockState {
    @SerializedName("AUDITING")
    AUDITING,
    @SerializedName("SENDING")
    SENDING,
    @SerializedName("PAUSED")
    PAUSED,
    @SerializedName("STOPPED")
    STOPPED,
    @SerializedName("DEACTIVATED")
    DEACTIVATED
  }
  
  public enum UserProductCouponTag {
    @SerializedName("MEMBER")
    MEMBER
  }
  
  public static class MemberTagInfo {
    @SerializedName("member_card_id")
    public String memberCardId;
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
  
  public static class ComboPackage {
    @SerializedName("name")
    public String name;
  
    @SerializedName("pick_count")
    public Long pickCount;
  
    @SerializedName("choice_list")
    public List<ComboPackageChoice> choiceList = new ArrayList<ComboPackageChoice>();
  }
  
  public static class CouponAvailablePeriod {
    @SerializedName("available_begin_time")
    public String availableBeginTime;
  
    @SerializedName("available_end_time")
    public String availableEndTime;
  
    @SerializedName("available_days")
    public Long availableDays;
  
    @SerializedName("wait_days_after_receive")
    public Long waitDaysAfterReceive;
  
    @SerializedName("weekly_available_period")
    public FixedWeekPeriod weeklyAvailablePeriod;
  
    @SerializedName("irregular_available_period_list")
    public List<TimePeriod> irregularAvailablePeriodList;
  }
  
  public static class ExchangeCouponUsageRule {
    @SerializedName("threshold")
    public Long threshold;
  
    @SerializedName("exchange_price")
    public Long exchangePrice;
  }
  
  public enum CouponUsageMethod {
    @SerializedName("OFFLINE")
    OFFLINE,
    @SerializedName("MINI_PROGRAM")
    MINI_PROGRAM,
    @SerializedName("APP")
    APP,
    @SerializedName("PAYMENT_CODE")
    PAYMENT_CODE
  }
  
  public static class CouponAvailableStoreInfo {
    @SerializedName("description")
    public String description;
  
    @SerializedName("mini_program_appid")
    public String miniProgramAppid;
  
    @SerializedName("mini_program_path")
    public String miniProgramPath;
  }
  
  public enum CouponCodeDisplayMode {
    @SerializedName("INVISIBLE")
    INVISIBLE,
    @SerializedName("BARCODE")
    BARCODE,
    @SerializedName("QRCODE")
    QRCODE
  }
  
  public static class EntranceMiniProgram {
    @SerializedName("appid")
    public String appid;
  
    @SerializedName("path")
    public String path;
  
    @SerializedName("entrance_wording")
    public String entranceWording;
  
    @SerializedName("guidance_wording")
    public String guidanceWording;
  }
  
  public static class EntranceOfficialAccount {
    @SerializedName("appid")
    public String appid;
  }
  
  public static class EntranceFinder {
    @SerializedName("finder_id")
    public String finderId;
  
    @SerializedName("finder_video_id")
    public String finderVideoId;
  
    @SerializedName("finder_video_cover_image_url")
    public String finderVideoCoverImageUrl;
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
  
  public static class FixedWeekPeriod {
    @SerializedName("day_list")
    public List<WeekEnum> dayList;
  
    @SerializedName("day_period_list")
    public List<PeriodOfTheDay> dayPeriodList;
  }
  
  public static class TimePeriod {
    @SerializedName("begin_time")
    public String beginTime;
  
    @SerializedName("end_time")
    public String endTime;
  }
  
  public enum WeekEnum {
    @SerializedName("MONDAY")
    MONDAY,
    @SerializedName("TUESDAY")
    TUESDAY,
    @SerializedName("WEDNESDAY")
    WEDNESDAY,
    @SerializedName("THURSDAY")
    THURSDAY,
    @SerializedName("FRIDAY")
    FRIDAY,
    @SerializedName("SATURDAY")
    SATURDAY,
    @SerializedName("SUNDAY")
    SUNDAY
  }
  
  public static class PeriodOfTheDay {
    @SerializedName("begin_time")
    public Long beginTime;
  
    @SerializedName("end_time")
    public Long endTime;
  }
  
}
