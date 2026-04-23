package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func main() {
	// TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
	config, err := wxpay_utility.CreateMchConfig(
		"19xxxxxxxx",                 // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
		"1DDE55AD98Exxxxxxxxxx",      // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
		"/path/to/apiclient_key.pem", // 商户API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &UseUserProductCouponRequest{
		ProductCouponId: wxpay_utility.String("1000000013"),
		StockId:         wxpay_utility.String("1000000013001"),
		CouponCode:      wxpay_utility.String("Code_123456"),
		Appid:           wxpay_utility.String("wx233544546545989"),
		Openid:          wxpay_utility.String("oh-394z-6CGkNoJrsDLTTUKiAnp4"),
		UseTime:         wxpay_utility.Time(time.Now()),
		OutRequestNo:    wxpay_utility.String("MCHUSE202003101234"),
		BrandId:         wxpay_utility.String("120344"),
		AssociatedOrderInfo: &UserProductCouponAssociatedOrderInfo{
			TransactionId: wxpay_utility.String("4200000000123456789123456789"),
		},
	}

	response, err := UseUserProductCoupon(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func UseUserProductCoupon(config *wxpay_utility.MchConfig, request *UseUserProductCouponRequest) (response *UserProductCouponEntity, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/marketing/partner/product-coupon/users/{openid}/coupons/{coupon_code}/use"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{coupon_code}", url.PathEscape(*request.CouponCode), -1)
	reqUrl.Path = strings.Replace(reqUrl.Path, "{openid}", url.PathEscape(*request.Openid), -1)
	reqBody, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	httpRequest, err := http.NewRequest(method, reqUrl.String(), bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Wechatpay-Serial", config.WechatPayPublicKeyId())
	httpRequest.Header.Set("Content-Type", "application/json")
	authorization, err := wxpay_utility.BuildAuthorization(config.MchId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), reqBody)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Authorization", authorization)

	client := &http.Client{}
	httpResponse, err := client.Do(httpRequest)
	if err != nil {
		return nil, err
	}
	respBody, err := wxpay_utility.ExtractResponseBody(httpResponse)
	if err != nil {
		return nil, err
	}
	if httpResponse.StatusCode >= 200 && httpResponse.StatusCode < 300 {
		// 2XX 成功，验证应答签名
		err = wxpay_utility.ValidateResponse(
			config.WechatPayPublicKeyId(),
			config.WechatPayPublicKey(),
			&httpResponse.Header,
			respBody,
		)
		if err != nil {
			return nil, err
		}
		response := &UserProductCouponEntity{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}

		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(
			httpResponse.StatusCode,
			httpResponse.Header,
			respBody,
		)
	}
}

type UseUserProductCouponRequest struct {
	ProductCouponId             *string                                       `json:"product_coupon_id,omitempty"`
	StockId                     *string                                       `json:"stock_id,omitempty"`
	CouponCode                  *string                                       `json:"coupon_code,omitempty"`
	Appid                       *string                                       `json:"appid,omitempty"`
	Openid                      *string                                       `json:"openid,omitempty"`
	UseTime                     *time.Time                                    `json:"use_time,omitempty"`
	OutRequestNo                *string                                       `json:"out_request_no,omitempty"`
	BrandId                     *string                                       `json:"brand_id,omitempty"`
	StoreId                     *string                                       `json:"store_id,omitempty"`
	AssociatedOrderInfo         *UserProductCouponAssociatedOrderInfo         `json:"associated_order_info,omitempty"`
	AssociatedPayScoreOrderInfo *UserProductCouponAssociatedPayScoreOrderInfo `json:"associated_pay_score_order_info,omitempty"`
}

func (o *UseUserProductCouponRequest) MarshalJSON() ([]byte, error) {
	type Alias UseUserProductCouponRequest
	a := &struct {
		CouponCode *string `json:"coupon_code,omitempty"`
		Openid     *string `json:"openid,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		CouponCode: nil,
		Openid:     nil,
		Alias:      (*Alias)(o),
	}
	return json.Marshal(a)
}

type UserProductCouponEntity struct {
	CouponCode                   *string                       `json:"coupon_code,omitempty"`
	CouponState                  *UserProductCouponState       `json:"coupon_state,omitempty"`
	ValidBeginTime               *time.Time                    `json:"valid_begin_time,omitempty"`
	ValidEndTime                 *time.Time                    `json:"valid_end_time,omitempty"`
	ReceiveTime                  *string                       `json:"receive_time,omitempty"`
	SendRequestNo                *string                       `json:"send_request_no,omitempty"`
	SendChannel                  *UserProductCouponSendChannel `json:"send_channel,omitempty"`
	ConfirmRequestNo             *string                       `json:"confirm_request_no,omitempty"`
	ConfirmTime                  *time.Time                    `json:"confirm_time,omitempty"`
	DeactivateRequestNo          *string                       `json:"deactivate_request_no,omitempty"`
	DeactivateTime               *string                       `json:"deactivate_time,omitempty"`
	DeactivateReason             *string                       `json:"deactivate_reason,omitempty"`
	SingleUsageDetail            *CouponUsageDetail            `json:"single_usage_detail,omitempty"`
	ProgressiveBundleUsageDetail *CouponUsageDetail            `json:"progressive_bundle_usage_detail,omitempty"`
	UserProductCouponBundleInfo  *UserProductCouponBundleInfo  `json:"user_product_coupon_bundle_info,omitempty"`
	ProductCoupon                *ProductCouponEntity          `json:"product_coupon,omitempty"`
	Stock                        *StockEntity                  `json:"stock,omitempty"`
	Attach                       *string                       `json:"attach,omitempty"`
	ChannelCustomInfo            *string                       `json:"channel_custom_info,omitempty"`
	CouponTagInfo                *CouponTagInfo                `json:"coupon_tag_info,omitempty"`
	BrandId                      *string                       `json:"brand_id,omitempty"`
}

type UserProductCouponAssociatedOrderInfo struct {
	TransactionId *string `json:"transaction_id,omitempty"`
	OutTradeNo    *string `json:"out_trade_no,omitempty"`
	Mchid         *string `json:"mchid,omitempty"`
	SubMchid      *string `json:"sub_mchid,omitempty"`
}

type UserProductCouponAssociatedPayScoreOrderInfo struct {
	OrderId    *string `json:"order_id,omitempty"`
	OutOrderNo *string `json:"out_order_no,omitempty"`
	Mchid      *string `json:"mchid,omitempty"`
	SubMchid   *string `json:"sub_mchid,omitempty"`
}

type UserProductCouponState string

func (e UserProductCouponState) Ptr() *UserProductCouponState {
	return &e
}

const (
	USERPRODUCTCOUPONSTATE_CONFIRMING  UserProductCouponState = "CONFIRMING"
	USERPRODUCTCOUPONSTATE_PENDING     UserProductCouponState = "PENDING"
	USERPRODUCTCOUPONSTATE_EFFECTIVE   UserProductCouponState = "EFFECTIVE"
	USERPRODUCTCOUPONSTATE_USED        UserProductCouponState = "USED"
	USERPRODUCTCOUPONSTATE_EXPIRED     UserProductCouponState = "EXPIRED"
	USERPRODUCTCOUPONSTATE_DELETED     UserProductCouponState = "DELETED"
	USERPRODUCTCOUPONSTATE_DEACTIVATED UserProductCouponState = "DEACTIVATED"
)

type UserProductCouponSendChannel string

func (e UserProductCouponSendChannel) Ptr() *UserProductCouponSendChannel {
	return &e
}

const (
	USERPRODUCTCOUPONSENDCHANNEL_BRAND_MANAGE      UserProductCouponSendChannel = "BRAND_MANAGE"
	USERPRODUCTCOUPONSENDCHANNEL_API               UserProductCouponSendChannel = "API"
	USERPRODUCTCOUPONSENDCHANNEL_RECEIVE_COMPONENT UserProductCouponSendChannel = "RECEIVE_COMPONENT"
)

type CouponUsageDetail struct {
	UseRequestNo                *string                                       `json:"use_request_no,omitempty"`
	UseTime                     *time.Time                                    `json:"use_time,omitempty"`
	ReturnRequestNo             *string                                       `json:"return_request_no,omitempty"`
	ReturnTime                  *time.Time                                    `json:"return_time,omitempty"`
	AssociatedOrderInfo         *UserProductCouponAssociatedOrderInfo         `json:"associated_order_info,omitempty"`
	AssociatedPayScoreOrderInfo *UserProductCouponAssociatedPayScoreOrderInfo `json:"associated_pay_score_order_info,omitempty"`
}

type UserProductCouponBundleInfo struct {
	UserCouponBundleId    *string `json:"user_coupon_bundle_id,omitempty"`
	UserCouponBundleIndex *int64  `json:"user_coupon_bundle_index,omitempty"`
	TotalCount            *int64  `json:"total_count,omitempty"`
	UsedCount             *int64  `json:"used_count,omitempty"`
}

type ProductCouponEntity struct {
	ProductCouponId            *string                     `json:"product_coupon_id,omitempty"`
	Scope                      *ProductCouponScope         `json:"scope,omitempty"`
	Type                       *ProductCouponType          `json:"type,omitempty"`
	UsageMode                  *UsageMode                  `json:"usage_mode,omitempty"`
	SingleUsageInfo            *SingleUsageInfo            `json:"single_usage_info,omitempty"`
	ProgressiveBundleUsageInfo *ProgressiveBundleUsageInfo `json:"progressive_bundle_usage_info,omitempty"`
	DisplayInfo                *ProductCouponDisplayInfo   `json:"display_info,omitempty"`
	OutProductNo               *string                     `json:"out_product_no,omitempty"`
	State                      *ProductCouponState         `json:"state,omitempty"`
	DeactivateRequestNo        *string                     `json:"deactivate_request_no,omitempty"`
	DeactivateTime             *string                     `json:"deactivate_time,omitempty"`
	DeactivateReason           *string                     `json:"deactivate_reason,omitempty"`
	BrandId                    *string                     `json:"brand_id,omitempty"`
}

type StockEntity struct {
	ProductCouponId            *string               `json:"product_coupon_id,omitempty"`
	StockId                    *string               `json:"stock_id,omitempty"`
	Remark                     *string               `json:"remark,omitempty"`
	CouponCodeMode             *CouponCodeMode       `json:"coupon_code_mode,omitempty"`
	CouponCodeCountInfo        *CouponCodeCountInfo  `json:"coupon_code_count_info,omitempty"`
	StockSendRule              *StockSendRule        `json:"stock_send_rule,omitempty"`
	SingleUsageRule            *SingleUsageRule      `json:"single_usage_rule,omitempty"`
	ProgressiveBundleUsageRule *StockUsageRule       `json:"progressive_bundle_usage_rule,omitempty"`
	StockBundleInfo            *StockBundleInfo      `json:"stock_bundle_info,omitempty"`
	UsageRuleDisplayInfo       *UsageRuleDisplayInfo `json:"usage_rule_display_info,omitempty"`
	CouponDisplayInfo          *CouponDisplayInfo    `json:"coupon_display_info,omitempty"`
	NotifyConfig               *NotifyConfig         `json:"notify_config,omitempty"`
	StoreScope                 *StockStoreScope      `json:"store_scope,omitempty"`
	SentCountInfo              *StockSentCountInfo   `json:"sent_count_info,omitempty"`
	State                      *StockState           `json:"state,omitempty"`
	DeactivateRequestNo        *string               `json:"deactivate_request_no,omitempty"`
	DeactivateTime             *time.Time            `json:"deactivate_time,omitempty"`
	DeactivateReason           *string               `json:"deactivate_reason,omitempty"`
	BrandId                    *string               `json:"brand_id,omitempty"`
}

type CouponTagInfo struct {
	CouponTagList []UserProductCouponTag `json:"coupon_tag_list,omitempty"`
	MemberTagInfo *MemberTagInfo         `json:"member_tag_info,omitempty"`
}

type ProductCouponScope string

func (e ProductCouponScope) Ptr() *ProductCouponScope {
	return &e
}

const (
	PRODUCTCOUPONSCOPE_ALL    ProductCouponScope = "ALL"
	PRODUCTCOUPONSCOPE_SINGLE ProductCouponScope = "SINGLE"
)

type ProductCouponType string

func (e ProductCouponType) Ptr() *ProductCouponType {
	return &e
}

const (
	PRODUCTCOUPONTYPE_NORMAL   ProductCouponType = "NORMAL"
	PRODUCTCOUPONTYPE_DISCOUNT ProductCouponType = "DISCOUNT"
	PRODUCTCOUPONTYPE_EXCHANGE ProductCouponType = "EXCHANGE"
)

type UsageMode string

func (e UsageMode) Ptr() *UsageMode {
	return &e
}

const (
	USAGEMODE_SINGLE             UsageMode = "SINGLE"
	USAGEMODE_PROGRESSIVE_BUNDLE UsageMode = "PROGRESSIVE_BUNDLE"
)

type SingleUsageInfo struct {
	NormalCoupon   *NormalCouponUsageRule   `json:"normal_coupon,omitempty"`
	DiscountCoupon *DiscountCouponUsageRule `json:"discount_coupon,omitempty"`
}

type ProgressiveBundleUsageInfo struct {
	Count        *int64 `json:"count,omitempty"`
	IntervalDays *int64 `json:"interval_days,omitempty"`
}

type ProductCouponDisplayInfo struct {
	Name               *string        `json:"name,omitempty"`
	ImageUrl           *string        `json:"image_url,omitempty"`
	BackgroundUrl      *string        `json:"background_url,omitempty"`
	DetailImageUrlList []string       `json:"detail_image_url_list,omitempty"`
	OriginalPrice      *int64         `json:"original_price,omitempty"`
	ComboPackageList   []ComboPackage `json:"combo_package_list,omitempty"`
}

type ProductCouponState string

func (e ProductCouponState) Ptr() *ProductCouponState {
	return &e
}

const (
	PRODUCTCOUPONSTATE_AUDITING    ProductCouponState = "AUDITING"
	PRODUCTCOUPONSTATE_EFFECTIVE   ProductCouponState = "EFFECTIVE"
	PRODUCTCOUPONSTATE_DEACTIVATED ProductCouponState = "DEACTIVATED"
)

type CouponCodeMode string

func (e CouponCodeMode) Ptr() *CouponCodeMode {
	return &e
}

const (
	COUPONCODEMODE_WECHATPAY  CouponCodeMode = "WECHATPAY"
	COUPONCODEMODE_UPLOAD     CouponCodeMode = "UPLOAD"
	COUPONCODEMODE_API_ASSIGN CouponCodeMode = "API_ASSIGN"
)

type CouponCodeCountInfo struct {
	TotalCount     *int64 `json:"total_count,omitempty"`
	AvailableCount *int64 `json:"available_count,omitempty"`
}

type StockSendRule struct {
	MaxCount        *int64 `json:"max_count,omitempty"`
	MaxCountPerDay  *int64 `json:"max_count_per_day,omitempty"`
	MaxCountPerUser *int64 `json:"max_count_per_user,omitempty"`
}

type SingleUsageRule struct {
	CouponAvailablePeriod *CouponAvailablePeriod   `json:"coupon_available_period,omitempty"`
	NormalCoupon          *NormalCouponUsageRule   `json:"normal_coupon,omitempty"`
	DiscountCoupon        *DiscountCouponUsageRule `json:"discount_coupon,omitempty"`
	ExchangeCoupon        *ExchangeCouponUsageRule `json:"exchange_coupon,omitempty"`
}

type StockUsageRule struct {
	CouponAvailablePeriod *CouponAvailablePeriod   `json:"coupon_available_period,omitempty"`
	NormalCoupon          *NormalCouponUsageRule   `json:"normal_coupon,omitempty"`
	DiscountCoupon        *DiscountCouponUsageRule `json:"discount_coupon,omitempty"`
	ExchangeCoupon        *ExchangeCouponUsageRule `json:"exchange_coupon,omitempty"`
}

type StockBundleInfo struct {
	StockBundleId    *string `json:"stock_bundle_id,omitempty"`
	StockBundleIndex *int64  `json:"stock_bundle_index,omitempty"`
}

type UsageRuleDisplayInfo struct {
	CouponUsageMethodList    []CouponUsageMethod       `json:"coupon_usage_method_list,omitempty"`
	MiniProgramAppid         *string                   `json:"mini_program_appid,omitempty"`
	MiniProgramPath          *string                   `json:"mini_program_path,omitempty"`
	AppPath                  *string                   `json:"app_path,omitempty"`
	UsageDescription         *string                   `json:"usage_description,omitempty"`
	CouponAvailableStoreInfo *CouponAvailableStoreInfo `json:"coupon_available_store_info,omitempty"`
}

type CouponDisplayInfo struct {
	CodeDisplayMode         *CouponCodeDisplayMode   `json:"code_display_mode,omitempty"`
	BackgroundColor         *string                  `json:"background_color,omitempty"`
	EntranceMiniProgram     *EntranceMiniProgram     `json:"entrance_mini_program,omitempty"`
	EntranceOfficialAccount *EntranceOfficialAccount `json:"entrance_official_account,omitempty"`
	EntranceFinder          *EntranceFinder          `json:"entrance_finder,omitempty"`
}

type NotifyConfig struct {
	NotifyAppid *string `json:"notify_appid,omitempty"`
}

type StockStoreScope string

func (e StockStoreScope) Ptr() *StockStoreScope {
	return &e
}

const (
	STOCKSTORESCOPE_NONE     StockStoreScope = "NONE"
	STOCKSTORESCOPE_ALL      StockStoreScope = "ALL"
	STOCKSTORESCOPE_SPECIFIC StockStoreScope = "SPECIFIC"
)

type StockSentCountInfo struct {
	TotalCount *int64 `json:"total_count,omitempty"`
	TodayCount *int64 `json:"today_count,omitempty"`
}

type StockState string

func (e StockState) Ptr() *StockState {
	return &e
}

const (
	STOCKSTATE_AUDITING    StockState = "AUDITING"
	STOCKSTATE_SENDING     StockState = "SENDING"
	STOCKSTATE_PAUSED      StockState = "PAUSED"
	STOCKSTATE_STOPPED     StockState = "STOPPED"
	STOCKSTATE_DEACTIVATED StockState = "DEACTIVATED"
)

type UserProductCouponTag string

func (e UserProductCouponTag) Ptr() *UserProductCouponTag {
	return &e
}

const (
	USERPRODUCTCOUPONTAG_MEMBER UserProductCouponTag = "MEMBER"
)

type MemberTagInfo struct {
	MemberCardId *string `json:"member_card_id,omitempty"`
}

type NormalCouponUsageRule struct {
	Threshold      *int64 `json:"threshold,omitempty"`
	DiscountAmount *int64 `json:"discount_amount,omitempty"`
}

type DiscountCouponUsageRule struct {
	Threshold  *int64 `json:"threshold,omitempty"`
	PercentOff *int64 `json:"percent_off,omitempty"`
}

type ComboPackage struct {
	Name       *string              `json:"name,omitempty"`
	PickCount  *int64               `json:"pick_count,omitempty"`
	ChoiceList []ComboPackageChoice `json:"choice_list,omitempty"`
}

type CouponAvailablePeriod struct {
	AvailableBeginTime           *string          `json:"available_begin_time,omitempty"`
	AvailableEndTime             *string          `json:"available_end_time,omitempty"`
	AvailableDays                *int64           `json:"available_days,omitempty"`
	WaitDaysAfterReceive         *int64           `json:"wait_days_after_receive,omitempty"`
	WeeklyAvailablePeriod        *FixedWeekPeriod `json:"weekly_available_period,omitempty"`
	IrregularAvailablePeriodList []TimePeriod     `json:"irregular_available_period_list,omitempty"`
}

type ExchangeCouponUsageRule struct {
	Threshold     *int64 `json:"threshold,omitempty"`
	ExchangePrice *int64 `json:"exchange_price,omitempty"`
}

type CouponUsageMethod string

func (e CouponUsageMethod) Ptr() *CouponUsageMethod {
	return &e
}

const (
	COUPONUSAGEMETHOD_OFFLINE      CouponUsageMethod = "OFFLINE"
	COUPONUSAGEMETHOD_MINI_PROGRAM CouponUsageMethod = "MINI_PROGRAM"
	COUPONUSAGEMETHOD_APP          CouponUsageMethod = "APP"
	COUPONUSAGEMETHOD_PAYMENT_CODE CouponUsageMethod = "PAYMENT_CODE"
)

type CouponAvailableStoreInfo struct {
	Description      *string `json:"description,omitempty"`
	MiniProgramAppid *string `json:"mini_program_appid,omitempty"`
	MiniProgramPath  *string `json:"mini_program_path,omitempty"`
}

type CouponCodeDisplayMode string

func (e CouponCodeDisplayMode) Ptr() *CouponCodeDisplayMode {
	return &e
}

const (
	COUPONCODEDISPLAYMODE_INVISIBLE CouponCodeDisplayMode = "INVISIBLE"
	COUPONCODEDISPLAYMODE_BARCODE   CouponCodeDisplayMode = "BARCODE"
	COUPONCODEDISPLAYMODE_QRCODE    CouponCodeDisplayMode = "QRCODE"
)

type EntranceMiniProgram struct {
	Appid           *string `json:"appid,omitempty"`
	Path            *string `json:"path,omitempty"`
	EntranceWording *string `json:"entrance_wording,omitempty"`
	GuidanceWording *string `json:"guidance_wording,omitempty"`
}

type EntranceOfficialAccount struct {
	Appid *string `json:"appid,omitempty"`
}

type EntranceFinder struct {
	FinderId                 *string `json:"finder_id,omitempty"`
	FinderVideoId            *string `json:"finder_video_id,omitempty"`
	FinderVideoCoverImageUrl *string `json:"finder_video_cover_image_url,omitempty"`
}

type ComboPackageChoice struct {
	Name             *string `json:"name,omitempty"`
	Price            *int64  `json:"price,omitempty"`
	Count            *int64  `json:"count,omitempty"`
	ImageUrl         *string `json:"image_url,omitempty"`
	MiniProgramAppid *string `json:"mini_program_appid,omitempty"`
	MiniProgramPath  *string `json:"mini_program_path,omitempty"`
}

type FixedWeekPeriod struct {
	DayList       []WeekEnum       `json:"day_list,omitempty"`
	DayPeriodList []PeriodOfTheDay `json:"day_period_list,omitempty"`
}

type TimePeriod struct {
	BeginTime *string `json:"begin_time,omitempty"`
	EndTime   *string `json:"end_time,omitempty"`
}

type WeekEnum string

func (e WeekEnum) Ptr() *WeekEnum {
	return &e
}

const (
	WEEKENUM_MONDAY    WeekEnum = "MONDAY"
	WEEKENUM_TUESDAY   WeekEnum = "TUESDAY"
	WEEKENUM_WEDNESDAY WeekEnum = "WEDNESDAY"
	WEEKENUM_THURSDAY  WeekEnum = "THURSDAY"
	WEEKENUM_FRIDAY    WeekEnum = "FRIDAY"
	WEEKENUM_SATURDAY  WeekEnum = "SATURDAY"
	WEEKENUM_SUNDAY    WeekEnum = "SUNDAY"
)

type PeriodOfTheDay struct {
	BeginTime *int64 `json:"begin_time,omitempty"`
	EndTime   *int64 `json:"end_time,omitempty"`
}
