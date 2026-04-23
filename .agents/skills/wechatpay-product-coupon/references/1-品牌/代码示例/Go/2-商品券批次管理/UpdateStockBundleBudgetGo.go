package main

import (
	"bytes"
	"demo/wxpay_brand_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/brand/4015826866
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func main() {
	// TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/brand/4015415289
	config, err := wxpay_brand_utility.CreateBrandConfig(
		"xxxxxxxx",                   // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考 https://pay.weixin.qq.com/doc/brand/4015415289
		"1DDE55AD98Exxxxxxxxxx",      // 品牌API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015407570
		"/path/to/apiclient_key.pem", // 品牌API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015453439
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &UpdateStockBundleBudgetRequest{
		ProductCouponId:       wxpay_brand_utility.String("200000001"),
		StockBundleId:         wxpay_brand_utility.String("123456789"),
		OutRequestNo:          wxpay_brand_utility.String("BUDGET1212512514"),
		UpdateMode:            UPDATEBUDGETMODE_MAX_COUNT.Ptr(),
		CurrentMaxCount:       wxpay_brand_utility.Int64(1),
		TargetMaxCount:        wxpay_brand_utility.Int64(1),
		CurrentMaxCountPerDay: wxpay_brand_utility.Int64(1),
		TargetMaxCountPerDay:  wxpay_brand_utility.Int64(1),
	}

	response, err := UpdateStockBundleBudget(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func UpdateStockBundleBudget(config *wxpay_brand_utility.BrandConfig, request *UpdateStockBundleBudgetRequest) (response *StockBundleEntity, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/brand/marketing/product-coupon/product-coupons/{product_coupon_id}/stock-bundles/{stock_bundle_id}/update-budget"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{product_coupon_id}", url.PathEscape(*request.ProductCouponId), -1)
	reqUrl.Path = strings.Replace(reqUrl.Path, "{stock_bundle_id}", url.PathEscape(*request.StockBundleId), -1)
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
	authorization, err := wxpay_brand_utility.BuildAuthorization(config.BrandId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), reqBody)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Authorization", authorization)

	client := &http.Client{}
	httpResponse, err := client.Do(httpRequest)
	if err != nil {
		return nil, err
	}
	respBody, err := wxpay_brand_utility.ExtractResponseBody(httpResponse)
	if err != nil {
		return nil, err
	}
	if httpResponse.StatusCode >= 200 && httpResponse.StatusCode < 300 {
		// 2XX 成功，验证应答签名
		err = wxpay_brand_utility.ValidateResponse(
			config.WechatPayPublicKeyId(),
			config.WechatPayPublicKey(),
			&httpResponse.Header,
			respBody,
		)
		if err != nil {
			return nil, err
		}
		response := &StockBundleEntity{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}

		return response, nil
	} else {
		return nil, wxpay_brand_utility.NewApiException(
			httpResponse.StatusCode,
			httpResponse.Header,
			respBody,
		)
	}
}

type UpdateStockBundleBudgetRequest struct {
	OutRequestNo          *string           `json:"out_request_no,omitempty"`
	ProductCouponId       *string           `json:"product_coupon_id,omitempty"`
	StockBundleId         *string           `json:"stock_bundle_id,omitempty"`
	UpdateMode            *UpdateBudgetMode `json:"update_mode,omitempty"`
	CurrentMaxCount       *int64            `json:"current_max_count,omitempty"`
	TargetMaxCount        *int64            `json:"target_max_count,omitempty"`
	CurrentMaxCountPerDay *int64            `json:"current_max_count_per_day,omitempty"`
	TargetMaxCountPerDay  *int64            `json:"target_max_count_per_day,omitempty"`
}

func (o *UpdateStockBundleBudgetRequest) MarshalJSON() ([]byte, error) {
	type Alias UpdateStockBundleBudgetRequest
	a := &struct {
		ProductCouponId *string `json:"product_coupon_id,omitempty"`
		StockBundleId   *string `json:"stock_bundle_id,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		ProductCouponId: nil,
		StockBundleId:   nil,
		Alias:           (*Alias)(o),
	}
	return json.Marshal(a)
}

type StockBundleEntity struct {
	StockBundleId *string               `json:"stock_bundle_id,omitempty"`
	StockList     []StockEntityInBundle `json:"stock_list,omitempty"`
}

type UpdateBudgetMode string

func (e UpdateBudgetMode) Ptr() *UpdateBudgetMode { return &e }

const (
	UPDATEBUDGETMODE_MAX_COUNT         UpdateBudgetMode = "MAX_COUNT"
	UPDATEBUDGETMODE_MAX_COUNT_PER_DAY UpdateBudgetMode = "MAX_COUNT_PER_DAY"
)

type StockEntityInBundle struct {
	ProductCouponId            *string               `json:"product_coupon_id,omitempty"`
	StockId                    *string               `json:"stock_id,omitempty"`
	Remark                     *string               `json:"remark,omitempty"`
	CouponCodeMode             *CouponCodeMode       `json:"coupon_code_mode,omitempty"`
	CouponCodeCountInfo        *CouponCodeCountInfo  `json:"coupon_code_count_info,omitempty"`
	StockSendRule              *StockSendRule         `json:"stock_send_rule,omitempty"`
	ProgressiveBundleUsageRule *StockUsageRule        `json:"progressive_bundle_usage_rule,omitempty"`
	StockBundleInfo            *StockBundleInfo       `json:"stock_bundle_info,omitempty"`
	UsageRuleDisplayInfo       *UsageRuleDisplayInfo  `json:"usage_rule_display_info,omitempty"`
	CouponDisplayInfo          *CouponDisplayInfo     `json:"coupon_display_info,omitempty"`
	NotifyConfig               *NotifyConfig          `json:"notify_config,omitempty"`
	StoreScope                 *StockStoreScope       `json:"store_scope,omitempty"`
	SentCountInfo              *StockSentCountInfo    `json:"sent_count_info,omitempty"`
	State                      *StockState            `json:"state,omitempty"`
	DeactivateRequestNo        *string                `json:"deactivate_request_no,omitempty"`
	DeactivateTime             *time.Time             `json:"deactivate_time,omitempty"`
	DeactivateReason           *string                `json:"deactivate_reason,omitempty"`
}

type CouponCodeMode string

func (e CouponCodeMode) Ptr() *CouponCodeMode { return &e }

const (
	COUPONCODEMODE_WECHATPAY CouponCodeMode = "WECHATPAY"
	COUPONCODEMODE_UPLOAD    CouponCodeMode = "UPLOAD"
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

type StockUsageRule struct {
	CouponAvailablePeriod *CouponAvailablePeriod   `json:"coupon_available_period,omitempty"`
	NormalCoupon          *NormalCouponUsageRule    `json:"normal_coupon,omitempty"`
	DiscountCoupon        *DiscountCouponUsageRule  `json:"discount_coupon,omitempty"`
	ExchangeCoupon        *ExchangeCouponUsageRule  `json:"exchange_coupon,omitempty"`
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

func (e StockStoreScope) Ptr() *StockStoreScope { return &e }

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

func (e StockState) Ptr() *StockState { return &e }

const (
	STOCKSTATE_AUDITING    StockState = "AUDITING"
	STOCKSTATE_SENDING     StockState = "SENDING"
	STOCKSTATE_PAUSED      StockState = "PAUSED"
	STOCKSTATE_STOPPED     StockState = "STOPPED"
	STOCKSTATE_DEACTIVATED StockState = "DEACTIVATED"
)

type CouponAvailablePeriod struct {
	AvailableBeginTime           *string          `json:"available_begin_time,omitempty"`
	AvailableEndTime             *string          `json:"available_end_time,omitempty"`
	AvailableDays                *int64           `json:"available_days,omitempty"`
	WaitDaysAfterReceive         *int64           `json:"wait_days_after_receive,omitempty"`
	WeeklyAvailablePeriod        *FixedWeekPeriod `json:"weekly_available_period,omitempty"`
	IrregularAvailablePeriodList []TimePeriod     `json:"irregular_available_period_list,omitempty"`
}

type NormalCouponUsageRule struct {
	Threshold      *int64 `json:"threshold,omitempty"`
	DiscountAmount *int64 `json:"discount_amount,omitempty"`
}

type DiscountCouponUsageRule struct {
	Threshold  *int64 `json:"threshold,omitempty"`
	PercentOff *int64 `json:"percent_off,omitempty"`
}

type ExchangeCouponUsageRule struct {
	Threshold     *int64 `json:"threshold,omitempty"`
	ExchangePrice *int64 `json:"exchange_price,omitempty"`
}

type CouponUsageMethod string

func (e CouponUsageMethod) Ptr() *CouponUsageMethod { return &e }

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

func (e CouponCodeDisplayMode) Ptr() *CouponCodeDisplayMode { return &e }

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

type FixedWeekPeriod struct {
	DayList       []WeekEnum       `json:"day_list,omitempty"`
	DayPeriodList []PeriodOfTheDay `json:"day_period_list,omitempty"`
}

type TimePeriod struct {
	BeginTime *string `json:"begin_time,omitempty"`
	EndTime   *string `json:"end_time,omitempty"`
}

type WeekEnum string

func (e WeekEnum) Ptr() *WeekEnum { return &e }

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
