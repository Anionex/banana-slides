package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// 服务商模式 - 公共代码（HTTP客户端 + 数据模型）
//
// 与品牌直连的差异：
// 1. 使用 wxpay_utility（而非 wxpay_brand_utility）
// 2. API路径为 /v3/marketing/partner/product-coupon/product-coupons
// 3. 请求中需要额外传入 brand_id 字段
// 4. 配置使用 MchConfig（商户号）而非 BrandConfig（品牌ID）
// 5. 多次优惠模式使用 stock_bundle（StockBundleForCreate）

// ========== HTTP 客户端 ==========

func CreateProductCoupon(config *wxpay_utility.MchConfig, request *CreateProductCouponRequest) (response *CreateProductCouponResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/marketing/partner/product-coupon/product-coupons"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
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
		response := &CreateProductCouponResponse{}
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

// ========== 请求/响应数据结构定义 ==========

type CreateProductCouponRequest struct {
	OutRequestNo               *string                     `json:"out_request_no,omitempty"`
	Scope                      *ProductCouponScope         `json:"scope,omitempty"`
	Type                       *ProductCouponType          `json:"type,omitempty"`
	UsageMode                  *UsageMode                  `json:"usage_mode,omitempty"`
	SingleUsageInfo            *SingleUsageInfo            `json:"single_usage_info,omitempty"`
	ProgressiveBundleUsageInfo *ProgressiveBundleUsageInfo `json:"progressive_bundle_usage_info,omitempty"`
	DisplayInfo                *ProductCouponDisplayInfo   `json:"display_info,omitempty"`
	OutProductNo               *string                     `json:"out_product_no,omitempty"`
	Stock                      *StockForCreate             `json:"stock,omitempty"`
	StockBundle                *StockBundleForCreate       `json:"stock_bundle,omitempty"`
	BrandId                    *string                     `json:"brand_id,omitempty"`
}

type CreateProductCouponResponse struct {
	ProductCouponId            *string                     `json:"product_coupon_id,omitempty"`
	Scope                      *ProductCouponScope         `json:"scope,omitempty"`
	Type                       *ProductCouponType          `json:"type,omitempty"`
	UsageMode                  *UsageMode                  `json:"usage_mode,omitempty"`
	SingleUsageInfo            *SingleUsageInfo            `json:"single_usage_info,omitempty"`
	ProgressiveBundleUsageInfo *ProgressiveBundleUsageInfo `json:"progressive_bundle_usage_info,omitempty"`
	DisplayInfo                *ProductCouponDisplayInfo   `json:"display_info,omitempty"`
	OutProductNo               *string                     `json:"out_product_no,omitempty"`
	State                      *ProductCouponState         `json:"state,omitempty"`
	Stock                      *StockEntity                `json:"stock,omitempty"`
	StockBundle                *StockBundleEntity          `json:"stock_bundle,omitempty"`
	BrandId                    *string                     `json:"brand_id,omitempty"`
}

// ========== 枚举类型定义 ==========

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

type StockStoreScope string

func (e StockStoreScope) Ptr() *StockStoreScope {
	return &e
}

const (
	STOCKSTORESCOPE_NONE     StockStoreScope = "NONE"
	STOCKSTORESCOPE_ALL      StockStoreScope = "ALL"
	STOCKSTORESCOPE_SPECIFIC StockStoreScope = "SPECIFIC"
)

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

type CouponCodeDisplayMode string

func (e CouponCodeDisplayMode) Ptr() *CouponCodeDisplayMode {
	return &e
}

const (
	COUPONCODEDISPLAYMODE_INVISIBLE CouponCodeDisplayMode = "INVISIBLE"
	COUPONCODEDISPLAYMODE_BARCODE   CouponCodeDisplayMode = "BARCODE"
	COUPONCODEDISPLAYMODE_QRCODE    CouponCodeDisplayMode = "QRCODE"
)

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

// ========== 数据结构定义 ==========

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

type StockForCreate struct {
	Remark               *string               `json:"remark,omitempty"`
	CouponCodeMode       *CouponCodeMode       `json:"coupon_code_mode,omitempty"`
	StockSendRule        *StockSendRule        `json:"stock_send_rule,omitempty"`
	SingleUsageRule      *SingleUsageRule      `json:"single_usage_rule,omitempty"`
	UsageRuleDisplayInfo *UsageRuleDisplayInfo `json:"usage_rule_display_info,omitempty"`
	CouponDisplayInfo    *CouponDisplayInfo    `json:"coupon_display_info,omitempty"`
	NotifyConfig         *NotifyConfig         `json:"notify_config,omitempty"`
	StoreScope           *StockStoreScope      `json:"store_scope,omitempty"`
}

type StockBundleForCreate struct {
	Remark                     *string                 `json:"remark,omitempty"`
	CouponCodeMode             *CouponCodeMode         `json:"coupon_code_mode,omitempty"`
	StockSendRule              *StockSendRuleForBundle `json:"stock_send_rule,omitempty"`
	ProgressiveBundleUsageRule *StockBundleUsageRule   `json:"progressive_bundle_usage_rule,omitempty"`
	UsageRuleDisplayInfo       *UsageRuleDisplayInfo   `json:"usage_rule_display_info,omitempty"`
	CouponDisplayInfo          *CouponDisplayInfo      `json:"coupon_display_info,omitempty"`
	NotifyConfig               *NotifyConfig           `json:"notify_config,omitempty"`
	StoreScope                 *StockStoreScope        `json:"store_scope,omitempty"`
}

type StockEntity struct {
	ProductCouponId      *string               `json:"product_coupon_id,omitempty"`
	StockId              *string               `json:"stock_id,omitempty"`
	Remark               *string               `json:"remark,omitempty"`
	CouponCodeMode       *CouponCodeMode       `json:"coupon_code_mode,omitempty"`
	CouponCodeCountInfo  *CouponCodeCountInfo  `json:"coupon_code_count_info,omitempty"`
	StockSendRule        *StockSendRule        `json:"stock_send_rule,omitempty"`
	SingleUsageRule      *SingleUsageRule      `json:"single_usage_rule,omitempty"`
	UsageRuleDisplayInfo *UsageRuleDisplayInfo `json:"usage_rule_display_info,omitempty"`
	CouponDisplayInfo    *CouponDisplayInfo    `json:"coupon_display_info,omitempty"`
	NotifyConfig         *NotifyConfig         `json:"notify_config,omitempty"`
	StoreScope           *StockStoreScope      `json:"store_scope,omitempty"`
	SentCountInfo        *StockSentCountInfo   `json:"sent_count_info,omitempty"`
	State                *StockState           `json:"state,omitempty"`
	DeactivateRequestNo  *string               `json:"deactivate_request_no,omitempty"`
	DeactivateTime       *time.Time            `json:"deactivate_time,omitempty"`
	DeactivateReason     *string               `json:"deactivate_reason,omitempty"`
	BrandId              *string               `json:"brand_id,omitempty"`
}

type StockBundleEntity struct {
	StockBundleId *string               `json:"stock_bundle_id,omitempty"`
	StockList     []StockEntityInBundle `json:"stock_list,omitempty"`
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

type StockSendRuleForBundle struct {
	MaxCount        *int64 `json:"max_count,omitempty"`
	MaxCountPerDay  *int64 `json:"max_count_per_day,omitempty"`
	MaxCountPerUser *int64 `json:"max_count_per_user,omitempty"`
}

type StockBundleUsageRule struct {
	CouponAvailablePeriod *CouponAvailablePeriod    `json:"coupon_available_period,omitempty"`
	NormalCouponList      []NormalCouponUsageRule   `json:"normal_coupon_list,omitempty"`
	DiscountCouponList    []DiscountCouponUsageRule `json:"discount_coupon_list,omitempty"`
	ExchangeCouponList    []ExchangeCouponUsageRule `json:"exchange_coupon_list,omitempty"`
}

type CouponCodeCountInfo struct {
	TotalCount     *int64 `json:"total_count,omitempty"`
	AvailableCount *int64 `json:"available_count,omitempty"`
}

type StockSentCountInfo struct {
	TotalCount *int64 `json:"total_count,omitempty"`
	TodayCount *int64 `json:"today_count,omitempty"`
}

type StockEntityInBundle struct {
	ProductCouponId            *string               `json:"product_coupon_id,omitempty"`
	StockId                    *string               `json:"stock_id,omitempty"`
	Remark                     *string               `json:"remark,omitempty"`
	CouponCodeMode             *CouponCodeMode       `json:"coupon_code_mode,omitempty"`
	CouponCodeCountInfo        *CouponCodeCountInfo  `json:"coupon_code_count_info,omitempty"`
	StockSendRule              *StockSendRule        `json:"stock_send_rule,omitempty"`
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

type ComboPackageChoice struct {
	Name             *string `json:"name,omitempty"`
	Price            *int64  `json:"price,omitempty"`
	Count            *int64  `json:"count,omitempty"`
	ImageUrl         *string `json:"image_url,omitempty"`
	MiniProgramAppid *string `json:"mini_program_appid,omitempty"`
	MiniProgramPath  *string `json:"mini_program_path,omitempty"`
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

type CouponAvailableStoreInfo struct {
	Description      *string `json:"description,omitempty"`
	MiniProgramAppid *string `json:"mini_program_appid,omitempty"`
	MiniProgramPath  *string `json:"mini_program_path,omitempty"`
}

type CouponCodeDisplayMode_Deprecated = CouponCodeDisplayMode

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

type FixedWeekPeriod struct {
	DayList       []WeekEnum       `json:"day_list,omitempty"`
	DayPeriodList []PeriodOfTheDay `json:"day_period_list,omitempty"`
}

type TimePeriod struct {
	BeginTime *string `json:"begin_time,omitempty"`
	EndTime   *string `json:"end_time,omitempty"`
}

type PeriodOfTheDay struct {
	BeginTime *int64 `json:"begin_time,omitempty"`
	EndTime   *int64 `json:"end_time,omitempty"`
}
