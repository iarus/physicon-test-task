{
  class NetworkError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
    }
  }

  const API_URL = "https://krapipl.imumk.ru:8443/api/mobilev1/update";

  const loaderTemplateEl = document.querySelector("#loader-template");
  const filterTemplateEl = document.querySelector("#filter-template");
  const viewControlTemplateEl = document.querySelector("#view_control-template");
  const showCaseTemplateEl = document.querySelector("#showcase-template");
  const loaderRootEl = document.querySelector("#loader");
  const filterRootEl = document.querySelector("#filter");
  const viewControlRootEl = document.querySelector("#view_control");
  const showCaseRootEl = document.querySelector("#showcase");

  const filterStrategy = {
    grade: (search, value) => {
      if (search == "") return true;
      return value.split(";").includes(search);
    },
    title: (search, value) => {
      search = search.toLowerCase();
      value = value.toLowerCase();
      if (value.search(search) >= 0) return true;
      return false;
    },
  };

  _.templateSettings.interpolate = /{%=([\s\S]+?)%}/g;
  _.templateSettings.escape = /{%-([\s\S]+?)%}/g;
  _.templateSettings.evaluate = /{%([\s\S]+?)%}/g;

  (async () => {
    let loaderEl = mountLoader(loaderTemplateEl, loaderRootEl);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=utf-8",
        },
        body: JSON.stringify({
          data: "",
        }),
      });
      if (!response.ok) {
        throw new NetworkError(response.statusText);
      }

      try {
        const result = await response.json();
        if (result.errorMessage) {
          throw new Error(result.errorMessage);
        }

        const resultList = result.items;

        const updateShowCase = mountShowCase(
          { data: resultList, view: {}, filter: {} },
          showCaseTemplateEl,
          showCaseRootEl,
        );

        const viewControl = mountViewControl(viewControlTemplateEl, viewControlRootEl);
        viewControl.onChange = (viewProps) =>
          updateShowCase({
            data: dataFilter(resultList, filterControl.props),
            view: viewProps,
            filter: filterControl.props,
          });

        const filterControl = mountFilter(resultList, filterTemplateEl, filterRootEl);
        filterControl.onChange = (filterProps) =>
          updateShowCase({
            data: dataFilter(resultList, filterProps),
            view: viewControl.props,
            filter: filterProps,
          });
      } catch (error) {
        console.log(error);
        if (error instanceof SyntaxError) {
          alert("Некорректный ответ сервера, попробуйте позже.");
        } else throw error;
      }
    } catch (error) {
      if (error instanceof NetworkError) {
        alert("Ошибка подключения к серверу.");
      } else throw error;
    } finally {
      unmountLoader(loaderEl);
    }
  })();

  function mountLoader(tempEl, target) {
    const loaderEl = document.createElement("div");
    loaderEl.append(tempEl.content.cloneNode(true));
    target.append(loaderEl);
    return loaderEl;
  }

  function unmountLoader(element) {
    element.parentNode.removeChild(element);
  }

  function mountFilter(data, template, target) {
    const filterControl = {
      get props() {
        return filterHandler();
      },
      onChange: null,
    };
    const templateStr = template.innerHTML;

    target.innerHTML = _.template(templateStr)({
      subjectList: getFilterList(data, "subject"),
      genreList: getFilterList(data, "genre"),
      gradeList: getFilterList(data, "grade"),
    });

    const formEl = target.querySelector("form");
    formEl.addEventListener("submit", (event) => {
      event.preventDefault();
      formChangeHandler();
    });

    const selectEl = target.querySelectorAll("select");
    selectEl.forEach((el) => {
      el.addEventListener("change", () => formChangeHandler());
    });

    const formChangeHandler = () => {
      if (filterControl.onChange !== null) filterControl.onChange(filterHandler());
    };

    return filterControl;

    function filterHandler() {
      return convertFilterToObject(formEl);
    }

    function convertFilterToObject(form) {
      const formData = new FormData(form);
      return Array.from(formData).reduce((acc, [field, value]) => {
        if (value) {
          acc[field] = value;
        }
        return acc;
      }, {});
    }

    function getFilterList(data, field) {
      let uniqValues = Array.from(
        new Set(
          data
            .map((item) => {
              if (/;/.test(item[field])) {
                return item[field].split(";");
              }
              return item[field];
            })
            .flat(),
        ),
      );
      uniqValues = uniqValues.sort((a, b) => {
        if (Number.isNaN(Number(a)) || Number.isNaN(Number(b))) {
          if (a > b) return 1;
          if (a < b) return -1;
          return 0;
        } else {
          return a - b;
        }
      });
      return uniqValues;
    }
  }

  function mountViewControl(template, target) {
    const viewControl = {
      get props() {
        return viewControlHandler();
      },
      onChange: null,
    };

    target.append(template.content.cloneNode(true));
    const formEl = target.querySelector("form");
    formEl.addEventListener("change", () => {
      if (viewControl.onChange !== null) viewControl.onChange(viewControlHandler());
    });

    return viewControl;

    function viewControlHandler() {
      return convertViewControlToObject(formEl);
    }

    function convertViewControlToObject(form) {
      const formData = new FormData(form);
      return Array.from(formData).reduce((acc, [field, value]) => {
        acc[field] = value;
        return acc;
      }, {});
    }
  }

  function mountShowCase(data, template, target) {
    const templateStr = template.innerHTML;
    target.innerHTML = _.template(templateStr)(data);
    return (data) => {
      target.innerHTML = _.template(templateStr)(data);
    };
  }

  function dataFilter(data, filter, strategy = filterStrategy) {
    const defaultFilter = (search, value) => {
      if (value.search(search) >= 0) return true;
      return false;
    };
    let filterArr = Object.entries(filter);

    return data.filter((item) => {
      const res = filterArr.map(([field, value]) => {
        if (strategy[field] === undefined) {
          return defaultFilter(value, item[field]);
        } else {
          return strategy[field](value, item[field]);
        }
      });
      if (res.includes(false)) return false;
      return true;
    });
  }
}
